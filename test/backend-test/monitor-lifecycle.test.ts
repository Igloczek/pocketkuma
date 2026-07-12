// @ts-nocheck

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const projectRoot = path.join(import.meta.dirname, "../..");
const credentials = { username: "monitor-test", password: "monitor-test-password" };

let appProcess;
let appPort;
let dataDir;
let proxyServer;
let envProxyServer;
let envProxyUrl;
let targetServer;
let targetUrl;
let realtime;
const proxyRequests = [];
const envProxyRequests = [];
const targetRequests = [];
const parentProxyEnv = Object.fromEntries(
    ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"].map((name) => [name, process.env[name]])
);

function withTimeout(promise, timeout, message) {
    let timeoutID;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timeoutID = setTimeout(() => reject(new Error(message)), timeout);
        }),
    ]).finally(() => clearTimeout(timeoutID));
}

function reservePort() {
    const listener = Bun.listen({
        hostname: "127.0.0.1",
        port: 0,
        socket: { data() {} },
    });
    const port = listener.port;
    listener.stop(true);
    return port;
}

function listen(server) {
    return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function startTargetServer() {
    return http.createServer((req, res) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
            const body = Buffer.concat(chunks).toString();
            targetRequests.push({
                url: req.url,
                method: req.method,
                body,
                authorization: req.headers.authorization,
                contentType: req.headers["content-type"],
                lifecycleHeader: req.headers["x-lifecycle"],
            });

            if (req.url === "/first") {
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("first target");
                return;
            }
            if (req.url === "/edited") {
                const valid =
                    req.method === "POST" &&
                    req.headers.authorization === "Basic dXNlcjpwYXNz" &&
                    req.headers["x-lifecycle"] === "edited" &&
                    req.headers["content-type"] === "application/json" &&
                    body === '{"version":"edited"}';
                res.writeHead(valid ? 200 : 401, { "Content-Type": "application/json" });
                res.end(JSON.stringify(valid ? { version: "edited" } : { error: "invalid request" }));
                return;
            }
            if (req.url === "/keyword") {
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("response contains lifecycle-keyword");
                return;
            }
            if (req.url === "/json") {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ service: { status: "green" } }));
                return;
            }
            if (req.url === "/status") {
                res.writeHead(418, { "Content-Type": "text/plain" });
                res.end("teapot");
                return;
            }

            res.writeHead(404);
            res.end("not found");
        });
    });
}

function startProxyServer() {
    return http.createServer((req, res) => {
        let target;
        try {
            target = new URL(req.url);
        } catch {
            res.writeHead(400);
            res.end("absolute proxy URL required");
            return;
        }

        proxyRequests.push(target.toString());
        if (target.hostname !== "127.0.0.1") {
            res.writeHead(502);
            res.end("public network disabled by fixture");
            return;
        }

        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", async () => {
            const headers = new Headers(req.headers);
            headers.delete("host");
            headers.delete("proxy-connection");
            headers.delete("content-length");
            const body = Buffer.concat(chunks);
            const response = await fetch(target, {
                method: req.method,
                headers,
                body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
            });
            res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
            res.end(await response.arrayBuffer());
        });
    });
}

function startRejectingEnvProxyServer() {
    return http.createServer((req, res) => {
        envProxyRequests.push(req.url);
        res.writeHead(502);
        res.end("environment proxy must not receive assigned monitor traffic");
    });
}

async function waitForApp() {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
        if (appProcess.exitCode !== null) {
            throw new Error(`PocketKuma exited before readiness with code ${appProcess.exitCode}`);
        }
        try {
            if ((await fetch(`http://127.0.0.1:${appPort}/api/entry-page`)).ok) {
                return;
            }
        } catch {}
        await Bun.sleep(50);
    }
    throw new Error("PocketKuma did not become ready within 30 seconds");
}

async function startApp() {
    appPort = reservePort();
    appProcess = Bun.spawn(
        ["bun", "src/server/server.ts", `--port=${appPort}`, "--host=127.0.0.1", `--data-dir=${dataDir}`, "--test"],
        {
            cwd: projectRoot,
            env: {
                ...process.env,
                NODE_ENV: "production",
                HTTP_PROXY: envProxyUrl,
                HTTPS_PROXY: envProxyUrl,
                NO_PROXY: "",
                UPTIME_KUMA_WS_ORIGIN_CHECK: "bypass",
            },
            stdout: "ignore",
            stderr: "ignore",
        }
    );
    await waitForApp();
}

async function stopApp() {
    realtime?.close();
    realtime = null;
    if (!appProcess || appProcess.exitCode !== null) {
        return;
    }
    appProcess.kill("SIGTERM");
    try {
        await withTimeout(appProcess.exited, 6_000, "PocketKuma did not stop after SIGTERM");
    } catch {
        appProcess.kill("SIGKILL");
        await appProcess.exited;
    }
}

async function connectRealtime() {
    const socket = new WebSocket(`ws://127.0.0.1:${appPort}/ws`);
    const callbacks = new Map();
    const events = [];
    const waiters = new Set();
    let nextID = 1;

    const ready = new Promise((resolve, reject) => {
        socket.addEventListener("error", () => reject(new Error("WebSocket connection failed")), { once: true });
        socket.addEventListener("message", (event) => {
            const message = JSON.parse(String(event.data));
            if (message.type === "event") {
                const item = { event: message.event, args: message.args || [] };
                events.push(item);
                for (const waiter of waiters) {
                    if (waiter.event === item.event && waiter.predicate(item.args)) {
                        waiters.delete(waiter);
                        waiter.resolve(item.args);
                    }
                }
                if (message.event === "loginRequired") {
                    resolve();
                }
            } else if ((message.type === "reply" || message.type === "error") && message.id) {
                const callback = callbacks.get(message.id);
                if (callback) {
                    callbacks.delete(message.id);
                    message.type === "error"
                        ? callback.reject(new Error(message.message))
                        : callback.resolve(message.args?.[0]);
                }
            }
        });
    });

    await withTimeout(ready, 10_000, "WebSocket handlers were not ready");
    return {
        events,
        close: () => socket.close(),
        mark: () => events.length,
        request(event, ...args) {
            const id = String(nextID++);
            const reply = new Promise((resolve, reject) => callbacks.set(id, { resolve, reject }));
            socket.send(JSON.stringify({ type: "event", event, args, id }));
            return withTimeout(reply, 10_000, `No reply for WebSocket event ${event}`);
        },
        waitFor(event, predicate, after = 0, timeout = 10_000) {
            const found = events.slice(after).find((item) => item.event === event && predicate(item.args));
            if (found) {
                return Promise.resolve(found.args);
            }
            const pending = new Promise((resolve) => waiters.add({ event, predicate, resolve }));
            return withTimeout(pending, timeout, `No matching WebSocket event ${event}`);
        },
    };
}

async function login({ setup = false } = {}) {
    realtime = await connectRealtime();
    if (setup) {
        expect((await realtime.request("setup", credentials.username, credentials.password)).ok).toBe(true);
    }
    expect(
        (
            await realtime.request("login", {
                username: credentials.username,
                password: credentials.password,
                token: "",
            })
        ).ok
    ).toBe(true);
}

function monitorPayload(overrides = {}) {
    return {
        type: "http",
        name: "Lifecycle monitor",
        parent: null,
        url: `${targetUrl}/first`,
        method: "GET",
        interval: 1,
        retryInterval: 1,
        resendInterval: 0,
        maxretries: 0,
        retryOnlyOnStatusCodeFailure: false,
        notificationIDList: {},
        ignoreTls: false,
        upsideDown: false,
        expiryNotification: false,
        domainExpiryNotification: false,
        maxredirects: 2,
        accepted_statuscodes: ["200-299"],
        saveResponse: false,
        saveErrorResponse: true,
        responseMaxLength: 1024,
        proxyId: null,
        authMethod: null,
        httpBodyEncoding: "json",
        kafkaProducerBrokers: [],
        kafkaProducerSaslOptions: { mechanism: "None" },
        rabbitmqNodes: [],
        conditions: [],
        cacheBust: false,
        timeout: 1,
        ...overrides,
    };
}

function heartbeatFor(monitorID, status) {
    return ([heartbeat]) => heartbeat.monitorID === monitorID && heartbeat.status === status;
}

beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pocketkuma-monitor-lifecycle-"));
    targetServer = startTargetServer();
    await listen(targetServer);
    targetUrl = `http://127.0.0.1:${targetServer.address().port}`;
    proxyServer = startProxyServer();
    await listen(proxyServer);
    envProxyServer = startRejectingEnvProxyServer();
    await listen(envProxyServer);
    envProxyUrl = `http://127.0.0.1:${envProxyServer.address().port}`;
    await startApp();
    await login({ setup: true });
});

afterAll(async () => {
    await stopApp();
    await new Promise((resolve) => targetServer.close(resolve));
    await new Promise((resolve) => proxyServer.close(resolve));
    await new Promise((resolve) => envProxyServer.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
    expect(
        Object.fromEntries(["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"].map((name) => [name, process.env[name]]))
    ).toEqual(parentProxyEnv);
});

describe("monitor lifecycle over the production WebSocket transport", () => {
    test("create, heartbeat, edit, HTTP contracts, pause/resume, reload, and delete", async () => {
        const proxy = await realtime.request(
            "addProxy",
            { protocol: "http", host: "127.0.0.1", port: proxyServer.address().port, auth: false, active: true },
            null
        );
        expect(proxy.ok).toBe(true);

        let payload = monitorPayload({ proxyId: proxy.id });
        const created = await realtime.request("add", payload);
        expect(created.ok).toBe(true);
        const monitorID = created.monitorID;
        await realtime.waitFor("heartbeat", heartbeatFor(monitorID, 1));
        expect(proxyRequests.some((url) => url.endsWith("/first"))).toBe(true);
        expect(envProxyRequests.some((url) => url?.endsWith("/first"))).toBe(false);

        const loaded = await realtime.request("getMonitor", monitorID);
        expect(loaded.ok).toBe(true);
        expect(loaded.monitor.url).toBe(`${targetUrl}/first`);

        let mark = realtime.mark();
        payload = {
            ...loaded.monitor,
            url: `${targetUrl}/edited`,
            method: "POST",
            body: '{"version":"edited"}',
            headers: '{"X-Lifecycle":"edited"}',
            authMethod: "basic",
            basic_auth_user: "user",
            basic_auth_pass: "pass",
            httpBodyEncoding: "json",
        };
        expect((await realtime.request("editMonitor", payload)).ok).toBe(true);
        await realtime.waitFor("heartbeat", heartbeatFor(monitorID, 1), mark);
        expect(targetRequests.at(-1)).toMatchObject({
            url: "/edited",
            method: "POST",
            body: '{"version":"edited"}',
            authorization: "Basic dXNlcjpwYXNz",
            contentType: "application/json",
            lifecycleHeader: "edited",
        });

        mark = realtime.mark();
        payload = {
            ...(await realtime.request("getMonitor", monitorID)).monitor,
            type: "keyword",
            url: `${targetUrl}/keyword`,
            method: "GET",
            body: null,
            headers: null,
            authMethod: null,
            keyword: "lifecycle-keyword",
        };
        expect((await realtime.request("editMonitor", payload)).ok).toBe(true);
        await realtime.waitFor("heartbeat", heartbeatFor(monitorID, 1), mark);

        mark = realtime.mark();
        payload.keyword = "missing-keyword";
        expect((await realtime.request("editMonitor", payload)).ok).toBe(true);
        await realtime.waitFor("heartbeat", heartbeatFor(monitorID, 0), mark);

        mark = realtime.mark();
        payload = {
            ...(await realtime.request("getMonitor", monitorID)).monitor,
            type: "json-query",
            url: `${targetUrl}/json`,
            jsonPath: "service.status",
            jsonPathOperator: "==",
            expectedValue: "green",
        };
        expect((await realtime.request("editMonitor", payload)).ok).toBe(true);
        await realtime.waitFor("heartbeat", heartbeatFor(monitorID, 1), mark);

        mark = realtime.mark();
        payload.expectedValue = "red";
        expect((await realtime.request("editMonitor", payload)).ok).toBe(true);
        await realtime.waitFor("heartbeat", heartbeatFor(monitorID, 0), mark);

        mark = realtime.mark();
        payload = {
            ...(await realtime.request("getMonitor", monitorID)).monitor,
            type: "http",
            url: `${targetUrl}/status`,
            accepted_statuscodes: ["418"],
        };
        expect((await realtime.request("editMonitor", payload)).ok).toBe(true);
        await realtime.waitFor("heartbeat", heartbeatFor(monitorID, 1), mark);

        mark = realtime.mark();
        payload.accepted_statuscodes = ["200-299"];
        expect((await realtime.request("editMonitor", payload)).ok).toBe(true);
        await realtime.waitFor("heartbeat", heartbeatFor(monitorID, 0), mark);

        mark = realtime.mark();
        payload = {
            ...(await realtime.request("getMonitor", monitorID)).monitor,
            type: "http",
            url: `${targetUrl}/edited`,
            method: "POST",
            body: '{"version":"edited"}',
            headers: '{"X-Lifecycle":"edited"}',
            authMethod: "basic",
            basic_auth_user: "user",
            basic_auth_pass: "pass",
            accepted_statuscodes: ["200-299"],
        };
        expect((await realtime.request("editMonitor", payload)).ok).toBe(true);
        await realtime.waitFor("heartbeat", heartbeatFor(monitorID, 1), mark);

        mark = realtime.mark();
        expect((await realtime.request("pauseMonitor", monitorID)).ok).toBe(true);
        await Bun.sleep(1_300);
        expect(
            realtime.events
                .slice(mark)
                .some((item) => item.event === "heartbeat" && item.args[0].monitorID === monitorID)
        ).toBe(false);

        mark = realtime.mark();
        expect((await realtime.request("resumeMonitor", monitorID)).ok).toBe(true);
        await realtime.waitFor("heartbeat", heartbeatFor(monitorID, 1), mark);

        for (let restart = 0; restart < 3; restart++) {
            const requestsBeforeReload = targetRequests.length;
            await stopApp();
            await startApp();
            await login();
            await withTimeout(
                (async () => {
                    while (targetRequests.length === requestsBeforeReload) {
                        await Bun.sleep(25);
                    }
                })(),
                5_000,
                `active monitor did not resume after reload ${restart + 1}`
            );
            expect(proxyRequests.some((url) => url.endsWith("/edited"))).toBe(true);
            expect(envProxyRequests.some((url) => url?.endsWith("/edited"))).toBe(false);
        }
        const persisted = await realtime.request("getMonitor", monitorID);
        expect(persisted.ok).toBe(true);
        expect(persisted.monitor).toMatchObject({
            active: true,
            url: `${targetUrl}/edited`,
            method: "POST",
            proxyId: proxy.id,
        });
        const beats = await realtime.request("getMonitorBeats", monitorID, 1);
        expect(beats.ok).toBe(true);
        expect(beats.data.some((beat) => beat.status === 1)).toBe(true);

        expect((await realtime.request("deleteMonitor", monitorID, false)).ok).toBe(true);
        const requestsAfterDelete = targetRequests.length;
        await Bun.sleep(1_300);
        expect(targetRequests.length).toBe(requestsAfterDelete);
        expect((await realtime.request("getMonitor", monitorID)).ok).toBe(false);
    }, 60_000);

    test("persisted SOCKS assignment stays stored and fails redacted before fetch", async () => {
        const username = "socks-user%@:/żółw";
        const password = "socks-password%@:/密碼";
        const encodedPassword = encodeURIComponent(password);
        const proxy = await realtime.request(
            "addProxy",
            {
                protocol: "socks5h",
                host: "127.0.0.1",
                port: 1080,
                auth: true,
                username,
                password,
                active: true,
            },
            null
        );
        expect(proxy.ok).toBe(true);

        const created = await realtime.request("add", monitorPayload({ proxyId: proxy.id }));
        expect(created.ok).toBe(true);
        const [heartbeat] = await realtime.waitFor("heartbeat", heartbeatFor(created.monitorID, 0));
        expect(heartbeat.msg).toMatch(/SOCKS proxy.*not supported.*Bun fetch/i);
        expect(heartbeat.msg).not.toContain(username);
        expect(heartbeat.msg).not.toContain(password);
        expect(heartbeat.msg).not.toContain(encodedPassword);

        await stopApp();
        await startApp();
        await login();
        const persisted = await realtime.request("getMonitor", created.monitorID);
        expect(persisted.ok).toBe(true);
        expect(persisted.monitor.proxyId).toBe(proxy.id);
        const proxyList = realtime.events.find((item) => item.event === "proxyList")?.args?.[0] ?? [];
        expect(proxyList.some((item) => item.id === proxy.id && item.protocol === "socks5h")).toBe(true);

        expect((await realtime.request("deleteMonitor", created.monitorID, false)).ok).toBe(true);
    }, 30_000);
});
