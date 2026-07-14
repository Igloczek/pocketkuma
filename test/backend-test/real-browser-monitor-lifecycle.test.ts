// @ts-nocheck

import { afterEach, beforeAll, describe, expect, jest, mock, spyOn, test } from "bun:test";
import { RemoteBrowser } from "@/server/remote-browser";

const chromium = {
    connect: mock(() => undefined),
    launch: mock(() => undefined),
};

mock.module("playwright-core", () => ({ chromium }));
mock.module("@/server/settings", () => ({
    Settings: {
        get: async () => "#playwright_chromium",
    },
}));

let Monitor;
let Database;
let RealBrowserMonitorType;
let resetChrome;
let testChrome;
let testRemoteBrowser;

beforeAll(async () => {
    await import("@/server/bun-sqlite-store");
    Database = (await import("@/server/database")).default;
    Database.screenshotDir = "/tmp";
    Monitor = (await import("@/server/model/monitor")).default;
    ({ RealBrowserMonitorType, resetChrome, testChrome, testRemoteBrowser } =
        await import("@/server/monitor-types/real-browser-monitor-type"));
});

afterEach(async () => {
    await resetChrome();
    chromium.connect.mockReset();
    chromium.launch.mockReset();
});

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => {
        resolve = done;
        reject = fail;
    });
    return { promise, reject, resolve };
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

function useBrowser(browser) {
    chromium.launch.mockResolvedValue(browser);
}

function successfulContext(overrides = {}) {
    return {
        newPage: mock(async () => successfulPage()),
        close: mock(async () => undefined),
        ...overrides,
    };
}

function successfulBrowser(overrides = {}) {
    return {
        isConnected: () => true,
        newContext: mock(async () => successfulContext()),
        close: mock(async () => undefined),
        ...overrides,
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
        useBrowser(browser);
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
        useBrowser(browser);
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

    test("Monitor.stop() actively aborts a real-browser check before its configured deadline", async () => {
        const newContext = deferred();
        const browser = successfulBrowser({ newContext: mock(() => newContext.promise) });
        useBrowser(browser);
        const instance = monitor();
        instance.timeout = 5;
        instance.activeHeartbeatAbortController = new AbortController();
        const check = new RealBrowserMonitorType().check(instance, {}, { jwtSecret: "test" }).catch((error) => error);
        instance.activeHeartbeat = check.then(() => {});
        for (let i = 0; i < 20 && browser.newContext.mock.calls.length === 0; i++) {
            await Bun.sleep(1);
        }

        const started = performance.now();
        await instance.stop();

        expect(performance.now() - started).toBeLessThan(300);
        expect(await check).toBeInstanceOf(Error);
        expect(browser.close).toHaveBeenCalledTimes(1);
    });

    test("a late local launch after cancellation is closed without becoming the cached browser", async () => {
        const launch = deferred();
        const lateBrowser = successfulBrowser();
        chromium.launch.mockReturnValue(launch.promise);
        const instance = monitor();
        const check = new RealBrowserMonitorType().check(instance, {}, { jwtSecret: "test" }).catch((error) => error);
        instance.activeHeartbeat = check.then(() => {});

        await instance.stop();
        expect(await check).toBeInstanceOf(Error);
        launch.resolve(lateBrowser);
        for (let i = 0; i < 20 && lateBrowser.close.mock.calls.length === 0; i++) {
            await Bun.sleep(5);
        }

        expect(lateBrowser.close).toHaveBeenCalledTimes(1);
        const replacement = successfulBrowser();
        chromium.launch.mockResolvedValue(replacement);
        await new RealBrowserMonitorType().check(monitor(), {}, { jwtSecret: "test" });
        expect(chromium.launch).toHaveBeenCalledTimes(2);
    });

    test.each(["newPage", "goto", "screenshot"])(
        "the whole-check deadline cancels a hung %s operation",
        async (phase) => {
            const hung = deferred();
            const page = successfulPage();
            const context = successfulContext();
            if (phase === "newPage") {
                context.newPage.mockReturnValue(hung.promise);
            } else {
                page[phase].mockReturnValue(hung.promise);
                context.newPage.mockResolvedValue(page);
            }
            const browser = successfulBrowser({ newContext: mock(async () => context) });
            useBrowser(browser);
            const heartbeat = {};

            const result = await new RealBrowserMonitorType()
                .check(monitor(), heartbeat, { jwtSecret: "test" })
                .catch((error) => error);

            expect(result).toBeInstanceOf(Error);
            expect(browser.close).toHaveBeenCalledTimes(1);
            expect(context.close).toHaveBeenCalledTimes(1);
            expect(heartbeat.status).toBeUndefined();
        }
    );

    test("a hung browser close escalates to the exact owned process kill", async () => {
        const close = deferred();
        const kill = mock(async () => undefined);
        const processKill = mock(() => true);
        const browserProcess = { kill, process: { kill: processKill } };
        const browser = successfulBrowser({
            newContext: mock(() => new Promise(() => {})),
            close: mock(() => close.promise),
        });
        browser._connection = { toImpl: () => ({ options: { browserProcess } }) };
        useBrowser(browser);
        const instance = monitor();
        instance.activeHeartbeatAbortController = new AbortController();
        const check = new RealBrowserMonitorType().check(instance, {}, { jwtSecret: "test" }).catch((error) => error);
        instance.activeHeartbeat = check.then(() => {});
        for (let i = 0; i < 20 && browser.newContext.mock.calls.length === 0; i++) {
            await Bun.sleep(1);
        }

        await instance.stop();

        expect(await check).toBeInstanceOf(Error);
        expect(browser.close).toHaveBeenCalledTimes(1);
        expect(kill).toHaveBeenCalledTimes(1);
        expect(processKill).not.toHaveBeenCalled();
    });

    test("a hung Playwright process kill falls back to one direct SIGKILL", async () => {
        const kill = mock(() => new Promise(() => {}));
        const processKill = mock(() => true);
        const browser = successfulBrowser({
            newContext: mock(() => new Promise(() => {})),
            close: mock(() => new Promise(() => {})),
        });
        browser._connection = {
            toImpl: () => ({ options: { browserProcess: { kill, process: { kill: processKill } } } }),
        };
        useBrowser(browser);
        const instance = monitor();
        instance.activeHeartbeatAbortController = new AbortController();
        const check = new RealBrowserMonitorType().check(instance, {}, { jwtSecret: "test" }).catch((error) => error);
        instance.activeHeartbeat = check.then(() => {});
        for (let i = 0; i < 20 && browser.newContext.mock.calls.length === 0; i++) {
            await Bun.sleep(1);
        }

        await instance.stop();

        expect(await check).toBeInstanceOf(Error);
        expect(kill).toHaveBeenCalledTimes(1);
        expect(processKill).toHaveBeenCalledTimes(1);
        expect(processKill).toHaveBeenCalledWith("SIGKILL");
    });

    test("one shared-browser timeout fails peers once and the next check relaunches", async () => {
        const firstContext = deferred();
        const secondContext = deferred();
        const contexts = [firstContext, secondContext];
        const firstBrowser = successfulBrowser({
            newContext: mock(() => contexts.shift().promise),
        });
        firstBrowser.close.mockImplementation(async () => {
            for (const pending of [firstContext, secondContext]) {
                pending.reject(new Error("shared browser closed"));
            }
        });
        const secondBrowser = successfulBrowser();
        chromium.launch.mockResolvedValueOnce(firstBrowser).mockResolvedValueOnce(secondBrowser);
        const first = monitor();
        const second = monitor();
        second.id = 2;

        const results = await Promise.all([
            new RealBrowserMonitorType().check(first, {}, { jwtSecret: "test" }).catch((error) => error),
            new RealBrowserMonitorType().check(second, {}, { jwtSecret: "test" }).catch((error) => error),
        ]);
        await new RealBrowserMonitorType().check(monitor(), {}, { jwtSecret: "test" });

        expect(results.every((result) => result instanceof Error)).toBe(true);
        expect(firstBrowser.close).toHaveBeenCalledTimes(1);
        expect(chromium.launch).toHaveBeenCalledTimes(2);
    });

    test("two hundred concurrent deadline races invalidate one shared browser without late success", async () => {
        const pendingContexts = Array.from({ length: 200 }, () => deferred());
        const queue = [...pendingContexts];
        const browser = successfulBrowser({ newContext: mock(() => queue.shift().promise) });
        browser.close.mockImplementation(async () => {
            for (const pending of pendingContexts) {
                pending.reject(new Error("shared browser closed"));
            }
        });
        useBrowser(browser);
        const heartbeats = Array.from({ length: 200 }, () => ({}));

        const results = await Promise.all(
            heartbeats.map((heartbeat, index) => {
                const instance = monitor();
                instance.id = index + 1;
                return new RealBrowserMonitorType()
                    .check(instance, heartbeat, { jwtSecret: "test" })
                    .catch((error) => error);
            })
        );

        expect(results.every((result) => result instanceof Error)).toBe(true);
        expect(heartbeats.every((heartbeat) => heartbeat.status === undefined)).toBe(true);
        expect(chromium.launch).toHaveBeenCalledTimes(1);
        expect(browser.close).toHaveBeenCalledTimes(1);
    });

    test("a late remote connection is disconnected and never cached after the deadline", async () => {
        const remote = spyOn(RemoteBrowser, "get").mockResolvedValue({
            id: 7,
            name: "test remote",
            url: "ws://remote.test/browser",
        });
        const connection = deferred();
        const lateBrowser = successfulBrowser();
        chromium.connect.mockReturnValue(connection.promise);
        const instance = monitor();
        Object.assign(instance, { remote_browser: 7, user_id: 11 });
        try {
            const result = await new RealBrowserMonitorType()
                .check(instance, {}, { jwtSecret: "test" })
                .catch((error) => error);
            expect(result).toBeInstanceOf(Error);

            connection.resolve(lateBrowser);
            for (let i = 0; i < 20 && lateBrowser.close.mock.calls.length === 0; i++) {
                await Bun.sleep(5);
            }
            expect(lateBrowser.close).toHaveBeenCalledTimes(1);
        } finally {
            remote.mockRestore();
        }
    });

    test("a remote browser with a hung close force-disconnects its Playwright channel", async () => {
        const remote = spyOn(RemoteBrowser, "get").mockResolvedValue({
            id: 8,
            name: "test remote",
            url: "ws://remote.test/browser",
        });
        const disconnect = mock(() => undefined);
        const browser = successfulBrowser({
            newContext: mock(() => new Promise(() => {})),
            close: mock(() => new Promise(() => {})),
            _connection: { close: disconnect },
        });
        chromium.connect.mockResolvedValue(browser);
        const instance = monitor();
        Object.assign(instance, {
            activeHeartbeatAbortController: new AbortController(),
            remote_browser: 8,
            user_id: 11,
        });
        const check = new RealBrowserMonitorType().check(instance, {}, { jwtSecret: "test" }).catch((error) => error);
        instance.activeHeartbeat = check.then(() => {});
        for (let i = 0; i < 20 && browser.newContext.mock.calls.length === 0; i++) {
            await Bun.sleep(1);
        }
        try {
            await instance.stop();
            expect(await check).toBeInstanceOf(Error);
            expect(browser.close).toHaveBeenCalledTimes(1);
            expect(disconnect).toHaveBeenCalledTimes(1);
        } finally {
            remote.mockRestore();
        }
    });

    test("Chromium and remote-browser connection tests have hard acquisition deadlines", async () => {
        chromium.launch.mockReturnValue(new Promise(() => {}));
        chromium.connect.mockReturnValue(new Promise(() => {}));
        jest.useFakeTimers();
        try {
            const local = testChrome("#playwright_chromium").catch((error) => error);
            const remote = testRemoteBrowser("ws://remote.test/browser").catch((error) => error);
            await Promise.resolve();
            jest.advanceTimersByTime(30_000);

            expect(await local).toBeInstanceOf(Error);
            expect(await remote).toBeInstanceOf(Error);
        } finally {
            jest.useRealTimers();
        }
    });
});
