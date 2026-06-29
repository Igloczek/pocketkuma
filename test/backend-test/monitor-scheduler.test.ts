// @ts-nocheck
const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const Monitor = require("../../src/server/model/monitor");

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

        assert.deepStrictEqual(clearedTimers, [1, 2]);
        assert.deepStrictEqual([...activeTimers], [3]);
        assert.strictEqual(monitor.heartbeatInterval, 3);
    });

    test("pause and stop clear future checks", async () => {
        const monitor = new Monitor();

        monitor.scheduleHeartbeat(() => {}, 1000);
        await monitor.stop();

        assert.deepStrictEqual(clearedTimers, [1]);
        assert.deepStrictEqual([...activeTimers], []);
        assert.strictEqual(monitor.heartbeatInterval, null);
        assert.strictEqual(monitor.isStop, true);
    });
});
