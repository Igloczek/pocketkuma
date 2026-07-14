// @ts-nocheck

import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";

const chromium = {
    launch: mock(() => undefined),
};

mock.module("playwright-core", () => ({ chromium }));
mock.module("@/server/settings", () => ({
    Settings: {
        get: async () => "#playwright_chromium",
    },
}));

let Monitor;
let RealBrowserMonitorType;
let resetChrome;

beforeAll(async () => {
    await import("@/server/bun-sqlite-store");
    Monitor = (await import("@/server/model/monitor")).default;
    ({ RealBrowserMonitorType, resetChrome } = await import("@/server/monitor-types/real-browser-monitor-type"));
});

afterEach(async () => {
    await resetChrome();
    chromium.launch.mockReset();
});

function deferred() {
    let resolve;
    const promise = new Promise((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

async function settleWithin(promise, timeoutMs) {
    let timer;
    try {
        return await Promise.race([
            promise.then(() => true),
            new Promise((resolve) => {
                timer = setTimeout(() => resolve(false), timeoutMs);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

function monitor() {
    const monitor = new Monitor();
    Object.assign(monitor, {
        id: 1,
        interval: 1,
        timeout: 0.1,
        url: "https://example.test",
        screenshot_delay: 0,
    });
    return monitor;
}

function successfulPage() {
    return {
        setDefaultTimeout: mock(() => undefined),
        goto: mock(async () => ({
            status: () => 200,
            request: () => ({ timing: () => ({ responseEnd: 12 }) }),
        })),
        screenshot: mock(async () => undefined),
    };
}

describe("real-browser monitor lifecycle", () => {
    test("Monitor.stop() cancels a hung browser.newContext() and closes its browser", async () => {
        const newContext = deferred();
        const close = mock(async () => undefined);
        const context = {
            newPage: mock(async () => {
                throw new Error("late context cleanup");
            }),
            close: mock(async () => undefined),
        };
        const browser = {
            isConnected: () => true,
            newContext: mock(() => newContext.promise),
            close,
        };
        chromium.launch.mockResolvedValue(browser);
        const instance = monitor();
        const check = new RealBrowserMonitorType().check(instance, {}, { jwtSecret: "test" }).catch((error) => error);
        instance.activeHeartbeat = check.then(() => {});

        const stopping = instance.stop();
        const stoppedWithoutReleasingProvider = await settleWithin(stopping, 350);
        if (!stoppedWithoutReleasingProvider) {
            newContext.resolve(context);
        }
        await stopping;

        expect(stoppedWithoutReleasingProvider).toBe(true);
        expect(await check).toBeInstanceOf(Error);
        expect(close).toHaveBeenCalledTimes(1);
    });

    test("Monitor.stop() bounds a hung context.close() and invalidates its browser", async () => {
        const contextClosed = deferred();
        const close = mock(async () => undefined);
        const context = {
            newPage: mock(async () => successfulPage()),
            close: mock(() => contextClosed.promise),
        };
        const browser = {
            isConnected: () => true,
            newContext: mock(async () => context),
            close,
        };
        chromium.launch.mockResolvedValue(browser);
        const instance = monitor();
        const heartbeat = {};
        const check = new RealBrowserMonitorType()
            .check(instance, heartbeat, { jwtSecret: "test" })
            .catch((error) => error);
        instance.activeHeartbeat = check.then(() => {});

        const stopping = instance.stop();
        const stoppedWithoutReleasingProvider = await settleWithin(stopping, 350);
        if (!stoppedWithoutReleasingProvider) {
            contextClosed.resolve();
        }
        await stopping;

        expect(stoppedWithoutReleasingProvider).toBe(true);
        expect(await check).toBeInstanceOf(Error);
        expect(close).toHaveBeenCalledTimes(1);
        expect(heartbeat.status).toBeUndefined();
    });
});
