// @ts-nocheck

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import Maintenance from "@/server/model/maintenance";

describe("maintenance validation and timer lifecycle", () => {
    const originalClearTimeout = global.clearTimeout;
    let clearedTimers;

    beforeEach(() => {
        clearedTimers = [];
        global.clearTimeout = (timer) => clearedTimers.push(timer);
    });

    afterEach(() => {
        global.clearTimeout = originalClearTimeout;
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

    test("stopping maintenance clears its cron and active-window timers", () => {
        const maintenance = { beanMeta: { job: { stop() {} }, durationTimeout: 42 } };

        Maintenance.prototype.stop.call(maintenance);

        expect(clearedTimers).toEqual([42]);
        expect(maintenance.beanMeta.job).toBeUndefined();
        expect(maintenance.beanMeta.durationTimeout).toBeUndefined();
    });
});
