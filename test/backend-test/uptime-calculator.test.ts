// @ts-nocheck

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { UptimeCalculator } from "@/server/uptime-calculator";
import dayjs from "dayjs";
import { UP, DOWN, PENDING, MAINTENANCE } from "@/util";
import dayjsPlugin_5 from "dayjs/plugin/utc";
import dayjsPlugin_6 from "@/modules/dayjs/plugin/timezone/index";
import dayjsPlugin_7 from "dayjs/plugin/customParseFormat";

dayjs.extend(dayjsPlugin_5);
dayjs.extend(dayjsPlugin_6);
dayjs.extend(dayjsPlugin_7);

describe("Uptime Calculator", () => {
    let previousTestBackend;

    beforeAll(() => {
        previousTestBackend = process.env.TEST_BACKEND;
        process.env.TEST_BACKEND = "1";
    });

    afterAll(() => {
        if (previousTestBackend === undefined) {
            delete process.env.TEST_BACKEND;
        } else {
            process.env.TEST_BACKEND = previousTestBackend;
        }
    });

    test("getCurrentDate() returns custom date when set", () => {
        let c1 = new UptimeCalculator();

        // Test custom date
        UptimeCalculator.currentDate = dayjs.utc("2021-01-01T00:00:00.000Z");
        expect(c1.getCurrentDate().unix()).toBe(dayjs.utc("2021-01-01T00:00:00.000Z").unix());
    });

    test("update() with UP status returns correct timestamp", async () => {
        UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");
        let c2 = new UptimeCalculator();
        let date = await c2.update(UP);
        expect(date.unix()).toBe(dayjs.utc("2023-08-12 20:46:59").unix());
    });

    test("update() with MAINTENANCE status returns correct timestamp", async () => {
        UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:47:20");
        let c2 = new UptimeCalculator();
        let date = await c2.update(MAINTENANCE);
        expect(date.unix()).toBe(dayjs.utc("2023-08-12 20:47:20").unix());
    });

    test("update() with DOWN status returns correct timestamp", async () => {
        UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:47:20");
        let c2 = new UptimeCalculator();
        let date = await c2.update(DOWN);
        expect(date.unix()).toBe(dayjs.utc("2023-08-12 20:47:20").unix());
    });

    test("update() with PENDING status returns correct timestamp", async () => {
        UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:47:20");
        let c2 = new UptimeCalculator();
        let date = await c2.update(PENDING);
        expect(date.unix()).toBe(dayjs.utc("2023-08-12 20:47:20").unix());
    });

    test("flatStatus() converts statuses correctly", () => {
        let c2 = new UptimeCalculator();
        expect(c2.flatStatus(UP)).toBe(UP);
        //expect(c2.flatStatus(MAINTENANCE), UP);
        expect(c2.flatStatus(DOWN)).toBe(DOWN);
        expect(c2.flatStatus(PENDING)).toBe(DOWN);
    });

    test("getMinutelyKey() returns correct timestamp for start of minute", () => {
        let c2 = new UptimeCalculator();
        let divisionKey = c2.getMinutelyKey(dayjs.utc("2023-08-12 20:46:00"));
        expect(divisionKey).toBe(dayjs.utc("2023-08-12 20:46:00").unix());

        // Edge case 1
        c2 = new UptimeCalculator();
        divisionKey = c2.getMinutelyKey(dayjs.utc("2023-08-12 20:46:01"));
        expect(divisionKey).toBe(dayjs.utc("2023-08-12 20:46:00").unix());

        // Edge case 2
        c2 = new UptimeCalculator();
        divisionKey = c2.getMinutelyKey(dayjs.utc("2023-08-12 20:46:59"));
        expect(divisionKey).toBe(dayjs.utc("2023-08-12 20:46:00").unix());
    });

    test("missing cleanup buckets are not created when createIfMissing is false", () => {
        let c2 = new UptimeCalculator();

        c2.getMinutelyKey(dayjs.utc("2023-08-12 20:46:59"));
        c2.getHourlyKey(dayjs.utc("2023-08-12 20:46:59"));
        c2.getDailyKey(dayjs.utc("2023-08-12 20:46:59"));

        let minutelyCleanupKey = c2.getMinutelyKey(dayjs.utc("2023-08-11 20:46:59"), false);
        let hourlyCleanupKey = c2.getHourlyKey(dayjs.utc("2023-07-13 20:46:59"), false);
        let dailyCleanupKey = c2.getDailyKey(dayjs.utc("2022-08-12 20:46:59"), false);

        expect(c2.minutelyUptimeDataList.length()).toBe(1);
        expect(c2.hourlyUptimeDataList.length()).toBe(1);
        expect(c2.dailyUptimeDataList.length()).toBe(1);
        expect(c2.minutelyUptimeDataList[minutelyCleanupKey]).toEqual(undefined);
        expect(c2.hourlyUptimeDataList[hourlyCleanupKey]).toEqual(undefined);
        expect(c2.dailyUptimeDataList[dailyCleanupKey]).toEqual(undefined);
    });

    test("cleanup lookup should not create missing minutely/hourly buckets", () => {
        let startDate = dayjs.utc("2023-08-12 00:00:00");

        // First test the broken version that creates missing buckets during cleanup lookup.
        let broken = new UptimeCalculator();
        let minutelyQueueLimit = broken.minutelyUptimeDataList.__limit;
        let hourlyQueueLimit = broken.hourlyUptimeDataList.__limit;
        let totalTicks = Math.max(minutelyQueueLimit, hourlyQueueLimit);

        let minutelyEndDate = startDate;
        let hourlyEndDate = startDate;
        for (let tick = 0; tick < totalTicks; tick++) {
            minutelyEndDate = startDate.add(tick, "minute");
            hourlyEndDate = startDate.add(tick, "hour");

            // Simulate normal key lookup that creates buckets.
            broken.getMinutelyKey(minutelyEndDate);
            broken.getHourlyKey(hourlyEndDate);

            // Simulate pre-fix cleanup key lookup that accidentally creates missing buckets.
            broken.getMinutelyKey(minutelyEndDate.subtract(broken.statMinutelyKeepHour, "hour"));
            broken.getHourlyKey(hourlyEndDate.subtract(broken.statHourlyKeepDay, "day"));
        }

        UptimeCalculator.currentDate = minutelyEndDate;
        expect(broken.getDataArray(minutelyQueueLimit, "minute").length).toBe(minutelyQueueLimit / 2);

        UptimeCalculator.currentDate = hourlyEndDate;
        expect(broken.getDataArray(hourlyQueueLimit, "hour").length).toBe(hourlyQueueLimit / 2);

        // Now test the fixed version that should not create missing buckets.
        let fixed = new UptimeCalculator();
        let fixedMinutelyTickDate = startDate;
        let fixedHourlyTickDate = startDate;
        for (let tick = 0; tick < totalTicks; tick++) {
            fixedMinutelyTickDate = startDate.add(tick, "minute");
            fixedHourlyTickDate = startDate.add(tick, "hour");

            // Simulate normal key lookup that creates buckets.
            fixed.getMinutelyKey(fixedMinutelyTickDate);
            fixed.getHourlyKey(fixedHourlyTickDate);

            // Simulate pre-fix cleanup key lookup that should not create missing buckets.
            fixed.getMinutelyKey(fixedMinutelyTickDate.subtract(fixed.statMinutelyKeepHour, "hour"), false);
            fixed.getHourlyKey(fixedHourlyTickDate.subtract(fixed.statHourlyKeepDay, "day"), false);
        }

        UptimeCalculator.currentDate = minutelyEndDate;
        expect(fixed.getDataArray(minutelyQueueLimit, "minute").length).toBe(minutelyQueueLimit);

        UptimeCalculator.currentDate = hourlyEndDate;
        expect(fixed.getDataArray(hourlyQueueLimit, "hour").length).toBe(hourlyQueueLimit);
    });

    test("getDailyKey() returns correct timestamp for start of day", () => {
        let c2 = new UptimeCalculator();
        let dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 20:46:00"));
        expect(dailyKey).toBe(dayjs.utc("2023-08-12").unix());

        c2 = new UptimeCalculator();
        dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 23:45:30"));
        expect(dailyKey).toBe(dayjs.utc("2023-08-12").unix());

        // Edge case 1
        c2 = new UptimeCalculator();
        dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 23:59:59"));
        expect(dailyKey).toBe(dayjs.utc("2023-08-12").unix());

        // Edge case 2
        c2 = new UptimeCalculator();
        dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 00:00:00"));
        expect(dailyKey).toBe(dayjs.utc("2023-08-12").unix());

        // Test timezone
        c2 = new UptimeCalculator();
        dailyKey = c2.getDailyKey(dayjs("Sat Dec 23 2023 05:38:39 GMT+0800 (Hong Kong Standard Time)"));
        expect(dailyKey).toBe(dayjs.utc("2023-12-22").unix());
    });

    test("lastDailyUptimeData tracks UP status correctly", async () => {
        let c2 = new UptimeCalculator();
        await c2.update(UP);
        expect(c2.lastDailyUptimeData.up).toBe(1);
    });

    test("get24Hour() calculates uptime and average ping correctly", async () => {
        UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");

        // No data
        let c2 = new UptimeCalculator();
        let data = c2.get24Hour();
        expect(data.uptime).toBe(0);
        expect(data.avgPing).toBe(null);

        // 1 Up
        c2 = new UptimeCalculator();
        await c2.update(UP, 100);
        let uptime = c2.get24Hour().uptime;
        expect(uptime).toBe(1);
        expect(c2.get24Hour().avgPing).toBe(100);

        // 2 Up
        c2 = new UptimeCalculator();
        await c2.update(UP, 100);
        await c2.update(UP, 200);
        uptime = c2.get24Hour().uptime;
        expect(uptime).toBe(1);
        expect(c2.get24Hour().avgPing).toBe(150);

        // 3 Up
        c2 = new UptimeCalculator();
        await c2.update(UP, 0);
        await c2.update(UP, 100);
        await c2.update(UP, 400);
        uptime = c2.get24Hour().uptime;
        expect(uptime).toBe(1);
        expect(c2.get24Hour().avgPing).toBe(166.66666666666666);

        // 1 MAINTENANCE
        c2 = new UptimeCalculator();
        await c2.update(MAINTENANCE);
        uptime = c2.get24Hour().uptime;
        expect(uptime).toBe(0);
        expect(c2.get24Hour().avgPing).toBe(null);

        // 1 PENDING
        c2 = new UptimeCalculator();
        await c2.update(PENDING);
        uptime = c2.get24Hour().uptime;
        expect(uptime).toBe(0);
        expect(c2.get24Hour().avgPing).toBe(null);

        // 1 DOWN
        c2 = new UptimeCalculator();
        await c2.update(DOWN);
        uptime = c2.get24Hour().uptime;
        expect(uptime).toBe(0);
        expect(c2.get24Hour().avgPing).toBe(null);

        // 2 DOWN
        c2 = new UptimeCalculator();
        await c2.update(DOWN);
        await c2.update(DOWN);
        uptime = c2.get24Hour().uptime;
        expect(uptime).toBe(0);
        expect(c2.get24Hour().avgPing).toBe(null);

        // 1 DOWN, 1 UP
        c2 = new UptimeCalculator();
        await c2.update(DOWN);
        await c2.update(UP, 0.5);
        uptime = c2.get24Hour().uptime;
        expect(uptime).toBe(0.5);
        expect(c2.get24Hour().avgPing).toBe(0.5);

        // 1 UP, 1 DOWN
        c2 = new UptimeCalculator();
        await c2.update(UP, 123);
        await c2.update(DOWN);
        uptime = c2.get24Hour().uptime;
        expect(uptime).toBe(0.5);
        expect(c2.get24Hour().avgPing).toBe(123);

        // Add 24 hours
        c2 = new UptimeCalculator();
        await c2.update(UP, 0);
        await c2.update(UP, 0);
        await c2.update(UP, 0);
        await c2.update(UP, 1);
        await c2.update(DOWN);
        uptime = c2.get24Hour().uptime;
        expect(uptime).toBe(0.8);
        expect(c2.get24Hour().avgPing).toBe(0.25);

        UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(24, "hour");

        // After 24 hours, even if there is no data, the uptime should be still 80%
        uptime = c2.get24Hour().uptime;
        expect(uptime).toBe(0.8);
        expect(c2.get24Hour().avgPing).toBe(0.25);

        // Add more 24 hours (48 hours)
        UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(24, "hour");

        // After 48 hours, even if there is no data, the uptime should be still 80%
        uptime = c2.get24Hour().uptime;
        expect(uptime).toBe(0.8);
        expect(c2.get24Hour().avgPing).toBe(0.25);
    });

    test("get7Day() calculates 7-day uptime correctly", async () => {
        UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");

        // No data
        let c2 = new UptimeCalculator();
        let uptime = c2.get7Day().uptime;
        expect(uptime).toBe(0);

        // 1 Up
        c2 = new UptimeCalculator();
        await c2.update(UP);
        uptime = c2.get7Day().uptime;
        expect(uptime).toBe(1);

        // 2 Up
        c2 = new UptimeCalculator();
        await c2.update(UP);
        await c2.update(UP);
        uptime = c2.get7Day().uptime;
        expect(uptime).toBe(1);

        // 3 Up
        c2 = new UptimeCalculator();
        await c2.update(UP);
        await c2.update(UP);
        await c2.update(UP);
        uptime = c2.get7Day().uptime;
        expect(uptime).toBe(1);

        // 1 MAINTENANCE
        c2 = new UptimeCalculator();
        await c2.update(MAINTENANCE);
        uptime = c2.get7Day().uptime;
        expect(uptime).toBe(0);

        // 1 PENDING
        c2 = new UptimeCalculator();
        await c2.update(PENDING);
        uptime = c2.get7Day().uptime;
        expect(uptime).toBe(0);

        // 1 DOWN
        c2 = new UptimeCalculator();
        await c2.update(DOWN);
        uptime = c2.get7Day().uptime;
        expect(uptime).toBe(0);

        // 2 DOWN
        c2 = new UptimeCalculator();
        await c2.update(DOWN);
        await c2.update(DOWN);
        uptime = c2.get7Day().uptime;
        expect(uptime).toBe(0);

        // 1 DOWN, 1 UP
        c2 = new UptimeCalculator();
        await c2.update(DOWN);
        await c2.update(UP);
        uptime = c2.get7Day().uptime;
        expect(uptime).toBe(0.5);

        // 1 UP).toBe(1 DOWN
        c2 = new UptimeCalculator();
        await c2.update(UP);
        await c2.update(DOWN);
        uptime = c2.get7Day().uptime;
        expect(uptime).toBe(0.5);

        // Add 7 days
        c2 = new UptimeCalculator();
        await c2.update(UP);
        await c2.update(UP);
        await c2.update(UP);
        await c2.update(UP);
        await c2.update(DOWN);
        uptime = c2.get7Day().uptime;
        expect(uptime).toBe(0.8);
        UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(7, "day");

        // After 7 days, even if there is no data, the uptime should be still 80%
        uptime = c2.get7Day().uptime;
        expect(uptime).toBe(0.8);
    });

    test("get30Day() calculates 30-day uptime correctly with 1 check per day", async () => {
        UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");

        let c2 = new UptimeCalculator();
        let uptime = c2.get30Day().uptime;
        expect(uptime).toBe(0);

        let up = 0;
        let down = 0;
        let flip = true;
        for (let i = 0; i < 30; i++) {
            UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(1, "day");

            if (flip) {
                await c2.update(UP);
                up++;
            } else {
                await c2.update(DOWN);
                down++;
            }

            uptime = c2.get30Day().uptime;
            expect(uptime).toBe(up / (up + down));

            flip = !flip;
        }

        // Last 7 days of daily checks: Down, Up, Down, Up, Down, Up, Down → 3 UP
        expect(c2.get7Day().uptime).toBe(3 / 7);
    });

    test("get1Year() calculates 1-year uptime correctly with 1 check per day", async () => {
        UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");

        let c2 = new UptimeCalculator();
        let uptime = c2.get1Year().uptime;
        expect(uptime).toBe(0);

        let flip = true;
        for (let i = 0; i < 365; i++) {
            UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(1, "day");

            if (flip) {
                await c2.update(UP);
            } else {
                await c2.update(DOWN);
            }

            flip = !flip;
        }

        expect(c2.get1Year().uptime).toBe(183 / 365);
        expect(c2.get30Day().uptime).toBe(15 / 30);
        expect(c2.get7Day().uptime).toBe(4 / 7);
    });

    describe("Worst case scenario", () => {
        test(
            "caps rolling minutely/daily windows after a year of sustained updates",
            async () => {
                const c = new UptimeCalculator();
                let up = 0;
                let down = 0;

                const pickStatus = () => {
                    const rand = Math.random();
                    if (rand < 0.25) {
                        return UP;
                    }
                    if (rand < 0.5) {
                        return DOWN;
                    }
                    if (rand < 0.75) {
                        return MAINTENANCE;
                    }
                    return PENDING;
                };

                const recordStatus = (status) => {
                    if (status === UP) {
                        up++;
                    } else if (status === DOWN || status === PENDING) {
                        down++;
                    }
                };

                UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");

                // Since 2023-08-12 is out of the 365-day range, aggregation starts on 2023-08-13.
                const actualStartDate = dayjs.utc("2023-08-13 00:00:00").unix();

                const bump = async (status) => {
                    if (UptimeCalculator.currentDate.unix() > actualStartDate) {
                        recordStatus(status);
                    }
                    await c.update(status);
                };

                // Phase 1: advance ~364 days with one update per day (fills the 365-day window).
                for (let day = 0; day < 364; day++) {
                    UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(1, "day");
                    await bump(pickStatus());
                }

                // Phase 2: final 24h at 20s intervals (fills the 1440-minute window).
                const highFrequencySteps = (24 * 60 * 60) / 20;
                for (let step = 0; step < highFrequencySteps; step++) {
                    UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(20, "second");
                    await bump(pickStatus());
                }

                expect(c.minutelyUptimeDataList.length()).toBe(1440);
                expect(c.dailyUptimeDataList.length()).toBe(365);
                expect(c.get1Year().uptime).toBe(up / (up + down));
            },
            { timeout: 60_000 }
        );
    });
});
