// @ts-nocheck

import { afterEach, beforeAll, describe, expect, jest, mock, spyOn, test } from "bun:test";
import { RemoteBrowser } from "@/server/remote-browser";

const chromium = {
    connect: mock(() => undefined),
    launch: mock(() => undefined),
};
let configuredExecutable = "#playwright_chromium";

mock.module("playwright-core", () => ({ chromium }));
mock.module("@/server/settings", () => ({
    Settings: {
        get: async () => configuredExecutable,
    },
}));

let Monitor;
let Database;
let RealBrowserMonitorType;
let resetChrome;
let resetRemoteBrowser;
let testChrome;
let testRemoteBrowser;

beforeAll(async () => {
    await import("@/server/bun-sqlite-store");
    Database = (await import("@/server/database")).default;
    Database.screenshotDir = "/tmp";
    Monitor = (await import("@/server/model/monitor")).default;
    ({ RealBrowserMonitorType, resetChrome, resetRemoteBrowser, testChrome, testRemoteBrowser } =
        await import("@/server/monitor-types/real-browser-monitor-type"));
});

afterEach(async () => {
    await resetChrome();
    configuredExecutable = "#playwright_chromium";
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
    test("a changed local executable cannot reuse the browser launched for the old setting", async () => {
        const originalAllowAll = process.env.UPTIME_KUMA_ALLOW_ALL_CHROME_EXEC;
        process.env.UPTIME_KUMA_ALLOW_ALL_CHROME_EXEC = "1";
        const firstBrowser = successfulBrowser();
        const secondBrowser = successfulBrowser();
        chromium.launch.mockResolvedValueOnce(firstBrowser).mockResolvedValueOnce(secondBrowser);
        configuredExecutable = "/first/chromium";
        try {
            await new RealBrowserMonitorType().check(monitor(), {}, { jwtSecret: "test" });
            configuredExecutable = "/second/chromium";
            await new RealBrowserMonitorType().check(monitor(), {}, { jwtSecret: "test" });

            expect(chromium.launch).toHaveBeenCalledTimes(2);
            expect(chromium.launch.mock.calls.map(([options]) => options.executablePath)).toEqual([
                "/first/chromium",
                "/second/chromium",
            ]);
            expect(firstBrowser.close).toHaveBeenCalledTimes(1);
        } finally {
            if (originalAllowAll === undefined) {
                delete process.env.UPTIME_KUMA_ALLOW_ALL_CHROME_EXEC;
            } else {
                process.env.UPTIME_KUMA_ALLOW_ALL_CHROME_EXEC = originalAllowAll;
            }
        }
    });

    test("resetChrome invalidates an idle successful owner before a replacement starts", async () => {
        const firstBrowser = successfulBrowser();
        const secondBrowser = successfulBrowser();
        chromium.launch.mockResolvedValueOnce(firstBrowser).mockResolvedValueOnce(secondBrowser);

        await new RealBrowserMonitorType().check(monitor(), {}, { jwtSecret: "test" });
        await Promise.all([resetChrome(), resetChrome()]);
        await new RealBrowserMonitorType().check(monitor(), {}, { jwtSecret: "test" });

        expect(firstBrowser.close).toHaveBeenCalledTimes(1);
        expect(secondBrowser.close).not.toHaveBeenCalled();
        expect(chromium.launch).toHaveBeenCalledTimes(2);
    });

    test("an unchanged local executable keeps reusing one healthy browser", async () => {
        const browser = successfulBrowser();
        useBrowser(browser);

        await new RealBrowserMonitorType().check(monitor(), {}, { jwtSecret: "test" });
        await new RealBrowserMonitorType().check(monitor(), {}, { jwtSecret: "test" });

        expect(chromium.launch).toHaveBeenCalledTimes(1);
        expect(browser.close).not.toHaveBeenCalled();
    });

    test("resetChrome waits for a pending local launch to retire before returning", async () => {
        const launch = deferred();
        const lateBrowser = successfulBrowser();
        chromium.launch.mockReturnValue(launch.promise);
        const check = new RealBrowserMonitorType().check(monitor(), {}, { jwtSecret: "test" }).catch((error) => error);
        for (let i = 0; i < 20 && chromium.launch.mock.calls.length === 0; i++) {
            await Bun.sleep(1);
        }

        const resetting = resetChrome();
        const resetReturnedBeforeRetirement = await settleWithin(resetting, 25);
        launch.resolve(lateBrowser);
        await resetting;

        expect(resetReturnedBeforeRetirement).toBe(false);
        expect(await settleWithin(check, 100)).toBe(true);
        expect(await check).toBeInstanceOf(Error);
        expect(lateBrowser.close).toHaveBeenCalledTimes(1);
    });

    test("two resets retire one pending local acquisition shared by one hundred checks", async () => {
        const launch = deferred();
        const lateBrowser = successfulBrowser();
        chromium.launch.mockReturnValue(launch.promise);
        const checks = Array.from({ length: 100 }, (_, index) => {
            const instance = monitor();
            instance.id = index + 1;
            return new RealBrowserMonitorType().check(instance, {}, { jwtSecret: "test" }).catch((error) => error);
        });
        for (let i = 0; i < 20 && chromium.launch.mock.calls.length === 0; i++) {
            await Bun.sleep(1);
        }

        const resets = Promise.all([resetChrome(), resetChrome()]);
        const resetReturnedBeforeRetirement = await settleWithin(resets, 25);
        launch.resolve(lateBrowser);
        await resets;
        const results = await Promise.all(checks);

        expect(resetReturnedBeforeRetirement).toBe(false);
        expect(chromium.launch).toHaveBeenCalledTimes(1);
        expect(results.every((result) => result instanceof Error)).toBe(true);
        expect(lateBrowser.close).toHaveBeenCalledTimes(1);
    });

    test("a pending local configuration retires before its replacement launches", async () => {
        const originalAllowAll = process.env.UPTIME_KUMA_ALLOW_ALL_CHROME_EXEC;
        process.env.UPTIME_KUMA_ALLOW_ALL_CHROME_EXEC = "1";
        const firstLaunch = deferred();
        const firstBrowser = successfulBrowser();
        const replacement = successfulBrowser();
        chromium.launch.mockReturnValueOnce(firstLaunch.promise).mockResolvedValueOnce(replacement);
        configuredExecutable = "/first/chromium";
        try {
            const first = new RealBrowserMonitorType()
                .check(monitor(), {}, { jwtSecret: "test" })
                .catch((error) => error);
            for (let i = 0; i < 20 && chromium.launch.mock.calls.length === 0; i++) {
                await Bun.sleep(1);
            }
            configuredExecutable = "/second/chromium";
            const second = new RealBrowserMonitorType().check(monitor(), {}, { jwtSecret: "test" });
            await Bun.sleep(25);
            const launchesBeforeRetirement = chromium.launch.mock.calls.length;
            firstLaunch.resolve(firstBrowser);

            expect(await first).toBeInstanceOf(Error);
            await second;
            expect(launchesBeforeRetirement).toBe(1);
            expect(chromium.launch).toHaveBeenCalledTimes(2);
            expect(firstBrowser.close).toHaveBeenCalledTimes(1);
            expect(replacement.close).not.toHaveBeenCalled();
        } finally {
            if (originalAllowAll === undefined) {
                delete process.env.UPTIME_KUMA_ALLOW_ALL_CHROME_EXEC;
            } else {
                process.env.UPTIME_KUMA_ALLOW_ALL_CHROME_EXEC = originalAllowAll;
            }
        }
    });

    test("resetChrome cancels an active context without closing a replacement owner", async () => {
        const firstContext = deferred();
        const firstBrowser = successfulBrowser({ newContext: mock(() => firstContext.promise) });
        firstBrowser.close.mockImplementation(async () => firstContext.reject(new Error("browser closed")));
        const replacement = successfulBrowser();
        chromium.launch.mockResolvedValueOnce(firstBrowser).mockResolvedValueOnce(replacement);
        const firstCheck = new RealBrowserMonitorType()
            .check(monitor(), {}, { jwtSecret: "test" })
            .catch((error) => error);
        for (let i = 0; i < 20 && firstBrowser.newContext.mock.calls.length === 0; i++) {
            await Bun.sleep(1);
        }

        const resetting = resetChrome();
        await new RealBrowserMonitorType().check(monitor(), {}, { jwtSecret: "test" });
        await resetting;

        expect(await firstCheck).toBeInstanceOf(Error);
        expect(firstBrowser.close).toHaveBeenCalledTimes(1);
        expect(replacement.close).not.toHaveBeenCalled();
        expect(chromium.launch).toHaveBeenCalledTimes(2);
    });

    test.each(["newContext", "newPage", "goto", "screenshot", "close"])(
        "resetChrome cancels an active %s phase",
        async (phase) => {
            const hung = deferred();
            const page = successfulPage();
            const context = successfulContext();
            const browser = successfulBrowser({ newContext: mock(async () => context) });
            if (phase === "newContext") {
                browser.newContext.mockReturnValue(hung.promise);
            } else if (phase === "newPage") {
                context.newPage.mockReturnValue(hung.promise);
            } else if (phase === "close") {
                context.close.mockReturnValue(hung.promise);
            } else {
                page[phase].mockReturnValue(hung.promise);
                context.newPage.mockResolvedValue(page);
            }
            useBrowser(browser);
            const heartbeat = {};
            const check = new RealBrowserMonitorType()
                .check(monitor(), heartbeat, { jwtSecret: "test" })
                .catch((error) => error);
            const activeCall =
                phase === "newContext"
                    ? browser.newContext
                    : phase === "newPage"
                      ? context.newPage
                      : phase === "close"
                        ? context.close
                        : page[phase];
            for (let i = 0; i < 20 && activeCall.mock.calls.length === 0; i++) {
                await Bun.sleep(1);
            }

            await resetChrome();

            expect(await settleWithin(check, 100)).toBe(true);
            expect(await check).toBeInstanceOf(Error);
            expect(browser.close).toHaveBeenCalledTimes(1);
            expect(heartbeat.status).toBeUndefined();
        }
    );

    test("a changed remote URL retires only the previous connection owner", async () => {
        let remoteURL = "ws://first.remote.test/browser";
        const remote = spyOn(RemoteBrowser, "get").mockImplementation(async (id) => ({
            id,
            name: "test remote",
            url: remoteURL,
        }));
        const firstBrowser = successfulBrowser();
        const secondBrowser = successfulBrowser();
        chromium.connect.mockResolvedValueOnce(firstBrowser).mockResolvedValueOnce(secondBrowser);
        const instance = monitor();
        Object.assign(instance, { remote_browser: 7, user_id: 11 });
        try {
            await new RealBrowserMonitorType().check(instance, {}, { jwtSecret: "test" });
            remoteURL = "ws://second.remote.test/browser";
            await new RealBrowserMonitorType().check(instance, {}, { jwtSecret: "test" });

            expect(chromium.connect).toHaveBeenCalledTimes(2);
            expect(firstBrowser.close).toHaveBeenCalledTimes(1);
            expect(secondBrowser.close).not.toHaveBeenCalled();
        } finally {
            remote.mockRestore();
        }
    });

    test("resetChrome waits for a pending remote connection to retire before returning", async () => {
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
        const check = new RealBrowserMonitorType().check(instance, {}, { jwtSecret: "test" }).catch((error) => error);
        try {
            for (let i = 0; i < 20 && chromium.connect.mock.calls.length === 0; i++) {
                await Bun.sleep(1);
            }
            const resetting = resetChrome();
            const resetReturnedBeforeRetirement = await settleWithin(resetting, 25);
            connection.resolve(lateBrowser);
            await resetting;

            expect(resetReturnedBeforeRetirement).toBe(false);
            expect(await settleWithin(check, 100)).toBe(true);
            expect(await check).toBeInstanceOf(Error);
            expect(lateBrowser.close).toHaveBeenCalledTimes(1);
        } finally {
            remote.mockRestore();
        }
    });

    test("one reset retires one hundred pending remote acquisitions before returning", async () => {
        const connections = Array.from({ length: 100 }, () => deferred());
        const browsers = Array.from({ length: 100 }, () => successfulBrowser());
        const remote = spyOn(RemoteBrowser, "get").mockImplementation(async (id) => ({
            id,
            name: `remote ${id}`,
            url: `ws://remote-${id}.test/browser`,
        }));
        chromium.connect.mockImplementation((url) => connections[Number(url.match(/remote-(\d+)/)?.[1]) - 1].promise);
        try {
            const checks = browsers.map((_, index) => {
                const instance = monitor();
                Object.assign(instance, { id: index + 1, remote_browser: index + 1, user_id: 11 });
                return new RealBrowserMonitorType().check(instance, {}, { jwtSecret: "test" }).catch((error) => error);
            });
            for (let i = 0; i < 50 && chromium.connect.mock.calls.length < 100; i++) {
                await Bun.sleep(1);
            }

            const resetting = resetChrome();
            const resetReturnedBeforeRetirement = await settleWithin(resetting, 25);
            connections.forEach((connection, index) => connection.resolve(browsers[index]));
            await resetting;
            const results = await Promise.all(checks);

            expect(resetReturnedBeforeRetirement).toBe(false);
            expect(chromium.connect).toHaveBeenCalledTimes(100);
            expect(results.every((result) => result instanceof Error)).toBe(true);
            expect(browsers.every((browser) => browser.close.mock.calls.length === 1)).toBe(true);
        } finally {
            remote.mockRestore();
        }
    });

    test("resetRemoteBrowser waits only for the matching pending user and browser", async () => {
        const connections = [deferred(), deferred()];
        const browsers = [successfulBrowser(), successfulBrowser()];
        const remote = spyOn(RemoteBrowser, "get").mockImplementation(async (id) => ({
            id,
            name: `remote ${id}`,
            url: `ws://remote-${id}.test/browser`,
        }));
        chromium.connect.mockImplementation((url) => connections[Number(url.match(/remote-(\d+)/)?.[1]) - 7].promise);
        const checks = [7, 8].map((remoteBrowser) => {
            const instance = monitor();
            Object.assign(instance, { remote_browser: remoteBrowser, user_id: 11 });
            return new RealBrowserMonitorType().check(instance, {}, { jwtSecret: "test" }).catch((error) => error);
        });
        try {
            for (let i = 0; i < 20 && chromium.connect.mock.calls.length < 2; i++) {
                await Bun.sleep(1);
            }

            const resetting = resetRemoteBrowser(7, 11);
            const resetReturnedBeforeRetirement = await settleWithin(resetting, 25);
            connections[0].resolve(browsers[0]);
            await resetting;

            expect(resetReturnedBeforeRetirement).toBe(false);
            expect(await checks[0]).toBeInstanceOf(Error);
            expect(browsers[0].close).toHaveBeenCalledTimes(1);
            expect(await settleWithin(checks[1], 25)).toBe(false);
            expect(browsers[1].close).not.toHaveBeenCalled();

            connections[1].resolve(browsers[1]);
            expect(await checks[1]).toBeUndefined();
            expect(browsers[1].close).not.toHaveBeenCalled();
        } finally {
            remote.mockRestore();
        }
    });

    test("one reset retires one hundred independent remote owners", async () => {
        const browsers = Array.from({ length: 100 }, () => successfulBrowser());
        const remote = spyOn(RemoteBrowser, "get").mockImplementation(async (id) => ({
            id,
            name: `remote ${id}`,
            url: `ws://remote-${id}.test/browser`,
        }));
        chromium.connect.mockImplementation(async (url) => browsers[Number(url.match(/remote-(\d+)/)?.[1]) - 1]);
        try {
            await Promise.all(
                browsers.map((_, index) => {
                    const instance = monitor();
                    Object.assign(instance, { id: index + 1, remote_browser: index + 1, user_id: 11 });
                    return new RealBrowserMonitorType().check(instance, {}, { jwtSecret: "test" });
                })
            );

            await resetChrome();

            expect(chromium.connect).toHaveBeenCalledTimes(100);
            expect(browsers.every((browser) => browser.close.mock.calls.length === 1)).toBe(true);
        } finally {
            remote.mockRestore();
        }
    });

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
        for (let i = 0; i < 20 && chromium.launch.mock.calls.length === 0; i++) {
            await Bun.sleep(1);
        }

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

    test("Monitor.stop() waits for a pending local launch to retire", async () => {
        const launch = deferred();
        const lateBrowser = successfulBrowser();
        chromium.launch.mockReturnValue(launch.promise);
        const instance = monitor();
        instance.activeHeartbeatAbortController = new AbortController();
        const check = new RealBrowserMonitorType().check(instance, {}, { jwtSecret: "test" }).catch((error) => error);
        instance.activeHeartbeat = check.then(() => {});
        for (let i = 0; i < 20 && chromium.launch.mock.calls.length === 0; i++) {
            await Bun.sleep(1);
        }

        const stopping = instance.stop();
        const stopReturnedBeforeRetirement = await settleWithin(stopping, 25);
        launch.resolve(lateBrowser);
        await stopping;

        expect(stopReturnedBeforeRetirement).toBe(false);
        expect(await check).toBeInstanceOf(Error);
        expect(lateBrowser.close).toHaveBeenCalledTimes(1);
        const replacement = successfulBrowser();
        chromium.launch.mockResolvedValue(replacement);
        await new RealBrowserMonitorType().check(monitor(), {}, { jwtSecret: "test" });
        expect(chromium.launch).toHaveBeenCalledTimes(2);
    });

    test("resetChrome hard-bounds an acquisition that ignores its Playwright timeout", async () => {
        const launch = deferred();
        const lateBrowser = successfulBrowser();
        chromium.launch.mockReturnValue(launch.promise);
        const instance = monitor();
        instance.timeout = 30;
        const check = new RealBrowserMonitorType().check(instance, {}, { jwtSecret: "test" }).catch((error) => error);
        for (let i = 0; i < 20 && chromium.launch.mock.calls.length === 0; i++) {
            await Bun.sleep(1);
        }

        const started = performance.now();
        const resetting = resetChrome().catch((error) => error);
        expect(await settleWithin(resetting, 6_000)).toBe(true);
        const resetResult = await resetting;
        const elapsed = performance.now() - started;
        launch.resolve(lateBrowser);
        for (let i = 0; i < 20 && lateBrowser.close.mock.calls.length === 0; i++) {
            await Bun.sleep(5);
        }

        expect(elapsed).toBeGreaterThanOrEqual(5_400);
        expect(elapsed).toBeLessThan(6_000);
        expect(resetResult).toBeInstanceOf(Error);
        expect(resetResult.message).toBe("Browser acquisition did not retire within 5.5 seconds");
        expect(await check).toBeInstanceOf(Error);
        expect(lateBrowser.close).toHaveBeenCalledTimes(1);
    }, 7_000);

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
            const check = new RealBrowserMonitorType()
                .check(instance, {}, { jwtSecret: "test" })
                .catch((error) => error);
            expect(await settleWithin(check, 150)).toBe(false);
            connection.resolve(lateBrowser);
            const result = await check;
            expect(result).toBeInstanceOf(Error);
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
