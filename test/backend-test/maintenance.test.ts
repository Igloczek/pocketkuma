// @ts-nocheck

import { afterEach, describe, expect, test } from "bun:test";
import Cron from "croner";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import Maintenance from "@/server/model/maintenance";
import { R } from "@/server/bun-sqlite-store";

dayjs.extend(utc);
dayjs.extend(timezone);

describe("maintenance validation and timer lifecycle", () => {
    const originalClearTimeout = global.clearTimeout;
    const originalStore = R.store;

    afterEach(() => {
        global.clearTimeout = originalClearTimeout;
        R.store = originalStore;
    });

    const schedule = (strategy, overrides = {}) => ({
        title: "Window",
        description: "",
        active: true,
        strategy,
        intervalDay: 1,
        timezoneOption: "Europe/Warsaw",
        dateRange: [null, null],
        timeRange: [
            { hours: 10, minutes: 0 },
            { hours: 11, minutes: 0 },
        ],
        weekdays: [],
        daysOfMonth: [],
        durationMinutes: 60,
        cron: "0 10 * * *",
        ...overrides,
    });

    test("rejects malformed schedules at the socket boundary", async () => {
        const base = {
            title: "Window",
            description: "",
            active: true,
            strategy: "single",
            intervalDay: 1,
            timezoneOption: "UTC",
            dateRange: ["2026-01-01T10:00", "2026-01-01T11:00"],
            timeRange: [
                { hours: 10, minutes: 0 },
                { hours: 11, minutes: 0 },
            ],
            weekdays: [],
            daysOfMonth: [],
            durationMinutes: 60,
            cron: "0 10 * * *",
        };

        for (const invalid of [
            { ...base, title: "" },
            { ...base, strategy: "not-a-strategy" },
            { ...base, timezoneOption: "Mars/Olympus" },
            { ...base, dateRange: [base.dateRange[1], base.dateRange[0]] },
            { ...base, dateRange: [null, base.dateRange[1]] },
            { ...base, strategy: "cron", durationMinutes: 0 },
            { ...base, strategy: "cron", durationMinutes: 24 * 60 + 1 },
            {
                ...base,
                strategy: "recurring-weekday",
                timeRange: [
                    { hours: 10, minutes: 0 },
                    { hours: 10, minutes: 0 },
                ],
            },
        ]) {
            await expect(Maintenance.jsonToBean(new Maintenance(), invalid)).rejects.toThrow();
        }
    });

    test("stopping maintenance clears its start, end, and active-window timers", () => {
        const clearedTimers = [];
        global.clearTimeout = (timer) => clearedTimers.push(timer);
        const stoppedJobs = [];
        const maintenance = {
            beanMeta: {
                job: { stop: () => stoppedJobs.push("start") },
                endJob: { stop: () => stoppedJobs.push("end") },
                durationTimeout: 42,
            },
        };

        Maintenance.prototype.stop.call(maintenance);

        expect(stoppedJobs).toEqual(["start", "end"]);
        expect(clearedTimers).toEqual([42]);
        expect(maintenance.beanMeta.job).toBeUndefined();
        expect(maintenance.beanMeta.endJob).toBeUndefined();
        expect(maintenance.beanMeta.durationTimeout).toBeUndefined();
    });

    test("paused schedules never recreate a cron job or timeout on reload", async () => {
        const clearedTimers = [];
        global.clearTimeout = (timer) => clearedTimers.push(timer);
        const maintenance = new Maintenance();
        Object.assign(maintenance, {
            id: 1,
            active: 0,
            strategy: "cron",
            cron: "* * * * *",
            duration: 60,
            timezone: "UTC",
            beanMeta: { job: { stop() {} }, durationTimeout: 99, status: "under-maintenance" },
        });

        await maintenance.run(true);

        expect(maintenance.beanMeta.job).toBeUndefined();
        expect(maintenance.beanMeta.durationTimeout).toBeUndefined();
        expect(maintenance.beanMeta.status).toBeUndefined();
        expect(clearedTimers).toEqual([99]);
    });

    test("serializes malformed legacy lists safely", async () => {
        const maintenance = new Maintenance();
        Object.assign(maintenance, {
            id: 1,
            title: "Legacy",
            description: "",
            active: false,
            strategy: "manual",
            weekdays: "{",
            days_of_month: "not-json",
        });
        maintenance.getTimezone = async () => "UTC";
        maintenance.getTimezoneOffset = async () => "+00:00";

        await expect(maintenance.toJSON()).resolves.toMatchObject({
            weekdays: [],
            daysOfMonth: [],
            status: "inactive",
        });
    });

    test("generates all six strategies and calendar boundaries deterministically", async () => {
        const cases = [
            ["manual", {}, undefined, undefined],
            ["single", { dateRange: ["2028-02-29T10:00", "2028-02-29T11:00"] }, undefined, undefined],
            ["cron", {}, "0 10 * * *", 3600],
            ["recurring-interval", { intervalDay: 2 }, "0 10  * * *", 3600],
            ["recurring-weekday", { weekdays: [0, 1, 6] }, "0 10 * * 0,1,6", 3600],
            ["recurring-day-of-month", { daysOfMonth: [1, 31, "lastDay1"] }, "0 10 1,31,L * *", 3600],
        ];

        for (const [strategy, overrides, expectedCron, expectedDuration] of cases) {
            const bean = await Maintenance.jsonToBean(new Maintenance(), schedule(strategy, overrides));
            expect(bean.cron).toBe(expectedCron);
            expect(bean.duration).toBe(expectedDuration);
        }

        const crossMidnight = await Maintenance.jsonToBean(
            new Maintenance(),
            schedule("recurring-weekday", {
                weekdays: [1],
                timeRange: [
                    { hours: 23, minutes: 0 },
                    { hours: 1, minutes: 0 },
                ],
            })
        );
        expect(crossMidnight.duration).toBe(7200);

        const monthEnd = new Cron("0 10 L * *", { timezone: "Europe/Warsaw", paused: true });
        expect(monthEnd.nextRun(new Date("2028-02-01T00:00:00Z")).toISOString()).toBe("2028-02-29T09:00:00.000Z");
        monthEnd.stop();

        const springDST = new Cron("30 2 * * *", { timezone: "Europe/Warsaw", paused: true });
        const springRuns = springDST.nextRuns(3, new Date("2026-03-28T00:00:00Z")).map((date) => date.toISOString());
        expect(springRuns).toEqual([
            "2026-03-28T01:30:00.000Z",
            "2026-03-29T01:30:00.000Z",
            "2026-03-30T00:30:00.000Z",
        ]);
        springDST.stop();

        const autumnDST = new Cron("30 2 * * *", { timezone: "Europe/Warsaw", paused: true });
        expect(autumnDST.nextRuns(3, new Date("2026-10-24T00:00:00Z")).map((date) => date.toISOString())).toEqual([
            "2026-10-24T00:30:00.000Z",
            "2026-10-25T01:30:00.000Z",
            "2026-10-26T01:30:00.000Z",
        ]);
        autumnDST.stop();
    });

    test("calculates recurring end instants in the schedule timezone across DST and calendar boundaries", async () => {
        const maintenance = new Maintenance();
        Object.assign(maintenance, {
            start_time: "01:30",
            end_time: "03:30",
            timezone: "Europe/Warsaw",
        });

        expect(await maintenance.getTimeslot(new Date("2026-03-29T00:30:00.000Z"))).toEqual({
            startDate: "2026-03-29T00:30:00.000Z",
            endDate: "2026-03-29T01:30:00.000Z",
        });
        expect(await maintenance.getTimeslot(new Date("2026-10-24T23:30:00.000Z"))).toEqual({
            startDate: "2026-10-24T23:30:00.000Z",
            endDate: "2026-10-25T02:30:00.000Z",
        });

        maintenance.end_time = "02:30";
        expect(await maintenance.getTimeslot(new Date("2026-03-29T00:30:00.000Z"))).toEqual({
            startDate: "2026-03-29T00:30:00.000Z",
            endDate: "2026-03-29T01:30:00.000Z",
        });
        expect(await maintenance.getTimeslot(new Date("2026-10-24T23:30:00.000Z"))).toEqual({
            startDate: "2026-10-24T23:30:00.000Z",
            endDate: "2026-10-25T01:30:00.000Z",
        });

        maintenance.start_time = "23:30";
        maintenance.end_time = "01:15";
        expect(await maintenance.getTimeslot(new Date("2028-02-29T22:30:00.000Z"))).toEqual({
            startDate: "2028-02-29T22:30:00.000Z",
            endDate: "2028-03-01T00:15:00.000Z",
        });
        expect(await maintenance.getTimeslot(new Date("2026-03-28T22:30:00.000Z"))).toEqual({
            startDate: "2026-03-28T22:30:00.000Z",
            endDate: "2026-03-29T00:15:00.000Z",
        });
    });

    test("single windows restore exactly one guarded end job and stop every callback", async () => {
        const now = Date.now();
        const date = (offset) => new Date(now + offset).toISOString();
        const active = Object.assign(new Maintenance(), {
            id: 1,
            user_id: 1,
            active: 1,
            strategy: "single",
            timezone: "UTC",
            start_date: date(-60_000),
            end_date: date(60_000),
        });

        await active.run(true);
        expect(active.beanMeta.job).toBeUndefined();
        expect(active.beanMeta.endJob).toBeDefined();
        const staleEnd = active.beanMeta.endJob.fn;
        active.stop();
        await expect(staleEnd()).resolves.toBeUndefined();
        expect(active.beanMeta.job).toBeUndefined();
        expect(active.beanMeta.endJob).toBeUndefined();

        const future = Object.assign(new Maintenance(), {
            id: 2,
            user_id: 1,
            active: 1,
            strategy: "single",
            timezone: "UTC",
            start_date: date(60_000),
            end_date: date(120_000),
        });
        await future.run(true);
        expect(future.beanMeta.job).toBeDefined();
        expect(future.beanMeta.endJob).toBeDefined();
        future.stop();

        const ended = Object.assign(new Maintenance(), {
            id: 3,
            user_id: 1,
            active: 1,
            strategy: "single",
            timezone: "UTC",
            start_date: date(-120_000),
            end_date: date(-60_000),
        });
        await ended.run(true);
        expect(ended.beanMeta.job).toBeUndefined();
        expect(ended.beanMeta.endJob).toBeUndefined();
    });

    test("keeps exactly one job across twenty reloads and blocks callbacks after stop", async () => {
        const maintenance = Object.assign(R.dispense("maintenance"), {
            id: 1,
            user_id: 1,
            active: 1,
            strategy: "cron",
            cron: "0 10 * * *",
            duration: 60,
            timezone: "UTC",
            start_date: "2020-01-01T00:00",
        });
        const previousJobs = [];

        for (let index = 0; index < 20; index++) {
            await maintenance.run(true);
            expect(maintenance.beanMeta.job).toBeDefined();
            expect(previousJobs.every((job) => job.isStopped())).toBe(true);
            previousJobs.push(maintenance.beanMeta.job);
        }

        let releaseTimezone;
        let timezoneCalls = 0;
        maintenance.getTimezone = () => {
            timezoneCalls++;
            if (timezoneCalls === 1) {
                return Promise.resolve("UTC");
            }
            return new Promise((resolve) => (releaseTimezone = resolve));
        };
        await maintenance.run(true);
        const pendingCallback = maintenance.beanMeta.job.fn();
        maintenance.stop();
        R.store = async () => {
            throw new Error("stopped callbacks must not persist");
        };
        releaseTimezone("UTC");
        await expect(pendingCallback).resolves.toBeUndefined();
        expect(maintenance.beanMeta.job).toBeUndefined();
        expect(maintenance.beanMeta.endJob).toBeUndefined();
        expect(maintenance.beanMeta.durationTimeout).toBeUndefined();
        expect(maintenance.beanMeta.status).toBeUndefined();
        expect(maintenance.last_start_date).toBeUndefined();
    });

    test("does not recreate an active-window timeout after stop during duration resolution", async () => {
        const maintenance = Object.assign(new Maintenance(), {
            id: 1,
            user_id: 1,
            active: 1,
            strategy: "cron",
            cron: "0 10 * * *",
            duration: 60,
            timezone: "UTC",
        });
        await maintenance.run(true);

        let releaseDuration;
        maintenance.inferDuration = () => new Promise((resolve) => (releaseDuration = resolve));
        const pendingCallback = maintenance.beanMeta.job.fn();
        await Bun.sleep(0);
        maintenance.stop();
        R.store = async () => {
            throw new Error("stopped callbacks must not persist");
        };
        releaseDuration(1_000);

        await expect(pendingCallback).resolves.toBeUndefined();
        expect(maintenance.beanMeta.job).toBeUndefined();
        expect(maintenance.beanMeta.durationTimeout).toBeUndefined();
        expect(maintenance.beanMeta.status).toBeUndefined();
        expect(maintenance.last_start_date).toBeUndefined();
    });
});
