// @ts-nocheck

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import Monitor from "../../src/server/model/monitor.ts";

describe("monitor scheduler timer control", () => {
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    let nextTimerID;
    let activeTimers;
    let clearedTimers;

    beforeEach(() => {
        nextTimerID = 1;
        activeTimers = new Set();
        clearedTimers = [];

        global.setTimeout = () => {
            const timerID = nextTimerID++;
            activeTimers.add(timerID);
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
});
