// @ts-nocheck

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import Monitor from "@/server/model/monitor";

describe("monitor scheduler timer control", () => {
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    let nextTimerID;
    let activeTimers;
    let clearedTimers;
    let scheduledDelays;

    beforeEach(() => {
        nextTimerID = 1;
        activeTimers = new Set();
        clearedTimers = [];
        scheduledDelays = [];

        global.setTimeout = (_callback, delay) => {
            const timerID = nextTimerID++;
            activeTimers.add(timerID);
            scheduledDelays.push(delay);
            return timerID;
        };

        global.clearTimeout = (timerID) => {
            clearedTimers.push(timerID);
            activeTimers.delete(timerID);
        };
    });

    afterEach(() => {
        global.setTimeout = originalSetTimeout;
        global.clearTimeout = originalClearTimeout;
    });

    test("repeated restart scheduling leaves one active check loop", () => {
        const monitor = new Monitor();

        monitor.scheduleHeartbeat(() => {}, 1000);
        monitor.scheduleHeartbeat(() => {}, 1000);
        monitor.scheduleHeartbeat(() => {}, 1000);

        expect(clearedTimers).toEqual([1, 2]);
        expect([...activeTimers]).toEqual([3]);
        expect(monitor.heartbeatInterval).toBe(3);
    });

    test("pause and stop clear future checks", async () => {
        const monitor = new Monitor();

        monitor.scheduleHeartbeat(() => {}, 1000);
        await monitor.stop();

        expect(clearedTimers).toEqual([1]);
        expect([...activeTimers]).toEqual([]);
        expect(monitor.heartbeatInterval).toBe(null);
        expect(monitor.isStop).toBe(true);
    });

    test("stop waits for the active heartbeat barrier", async () => {
        const monitor = new Monitor();
        let releaseHeartbeat;
        let stopped = false;
        monitor.activeHeartbeat = new Promise((resolve) => {
            releaseHeartbeat = resolve;
        });

        const stop = monitor.stop().then(() => {
            stopped = true;
        });
        await Promise.resolve();

        expect(stopped).toBe(false);
        releaseHeartbeat();
        await stop;
        expect(stopped).toBe(true);
    });

    test("malformed and overflowing legacy delays cannot create immediate or overflowing timers", () => {
        const monitor = new Monitor();

        for (const delay of ["bogus", NaN, Infinity, -Infinity, -1, 0, 2_073_600_001]) {
            monitor.scheduleHeartbeat(() => {}, delay);
        }

        expect(scheduledDelays).toEqual(Array(7).fill(1000));
        expect(activeTimers.size).toBe(1);
    });
});
