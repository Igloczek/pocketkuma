// @ts-nocheck

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database as BunDatabase } from "bun:sqlite";
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
let targetBarrier;
const proxyRequests = [];
const envProxyRequests = [];
const targetRequests = [];
const appLogs = [];
let appLogReaders = [];
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

function closeServer(server) {
    if (!server?.listening) {
        return Promise.resolve();
    }
    return new Promise((resolve) => server.close(resolve));
}

async function collectProcessOutput(stream) {
    if (!stream) {
        return;
    }
    for await (const chunk of stream) {
        appLogs.push(Buffer.from(chunk).toString());
    }
}

function startTargetServer() {
    return http.createServer((req, res) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", async () => {
            const body = Buffer.concat(chunks).toString();
            targetRequests.push({
                url: req.url,
                method: req.method,
                body,
                authorization: req.headers.authorization,
                proxyAuthorization: req.headers["proxy-authorization"],
                contentType: req.headers["content-type"],
                lifecycleHeader: req.headers["x-lifecycle"],
            });

            if (req.url === "/first") {
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("first target");
                return;
            }
            if (req.url === "/barrier") {
                targetBarrier?.arrive();
                await targetBarrier?.wait;
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("released target");
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

function armTargetBarrier() {
    let arrive;
    let release;
    const arrived = new Promise((resolve) => {
        arrive = resolve;
    });
    const wait = new Promise((resolve) => {
        release = resolve;
    });
    targetBarrier = { arrive, arrived, release, wait };
    return targetBarrier;
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

        proxyRequests.push({
            url: target.toString(),
            proxyAuthorization: req.headers["proxy-authorization"] ?? null,
        });
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
            headers.delete("proxy-authorization");
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
                NODE_ENV: "development",
                HTTP_PROXY: envProxyUrl,
                HTTPS_PROXY: envProxyUrl,
                NO_PROXY: "",
                UPTIME_KUMA_WS_ORIGIN_CHECK: "bypass",
                UPTIME_KUMA_LOG_FORMAT: "json",
            },
            stdout: "pipe",
            stderr: "pipe",
        }
    );
    appLogReaders = [collectProcessOutput(appProcess.stdout), collectProcessOutput(appProcess.stderr)];
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
    await Promise.allSettled(appLogReaders);
    appLogReaders = [];
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

async function reconnectAndGetProxyList() {
    realtime?.close();
    realtime = null;
    await login();
    return realtime.events.filter((item) => item.event === "proxyList").at(-1)?.args?.[0] ?? [];
}

function updateMonitorAssignment(monitorID, proxyID, { ignoreTls = false } = {}) {
    const db = new BunDatabase(path.join(dataDir, "kuma.db"), { strict: true });
    try {
        db.exec("PRAGMA foreign_keys = OFF");
        db.run("UPDATE monitor SET proxy_id = ?, ignore_tls = ? WHERE id = ?", [proxyID, ignoreTls ? 1 : 0, monitorID]);
    } finally {
        db.close();
    }
}

function insertForeignProxy(port) {
    const db = new BunDatabase(path.join(dataDir, "kuma.db"), { strict: true });
    try {
        db.run("INSERT OR IGNORE INTO user (username, password, active) VALUES (?, ?, 1)", [
            "foreign-proxy-owner",
            "not-used",
        ]);
        const userID = db.query("SELECT id FROM user WHERE username = ?").get("foreign-proxy-owner").id;
        const proxy = db.run(
            "INSERT INTO proxy (user_id, protocol, host, port, auth, username, password, active, `default`) VALUES (?, 'http', '127.0.0.1', ?, 1, ?, ?, 1, 0)",
            [userID, port, "foreign-user%@:/żółw", "foreign-password%@:/密碼"]
        );
        return Number(proxy.lastInsertRowid);
    } finally {
        db.close();
    }
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
    await Promise.all([closeServer(targetServer), closeServer(proxyServer), closeServer(envProxyServer)]);
    if (dataDir) {
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
    expect(
        Object.fromEntries(["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"].map((name) => [name, process.env[name]]))
    ).toEqual(parentProxyEnv);
});

describe("monitor lifecycle over the production WebSocket transport", () => {
    test("delete waits for an in-flight heartbeat and prevents stale writes", async () => {
        const barrier = armTargetBarrier();
        const logMark = appLogs.length;
        const eventMark = realtime.mark();
        const proxy = await realtime.request(
            "addProxy",
            { protocol: "http", host: "127.0.0.1", port: proxyServer.address().port, auth: false, active: true },
            null
        );
        const created = await realtime.request(
            "add",
            monitorPayload({ url: `${targetUrl}/barrier`, proxyId: proxy.id, timeout: 0 })
        );
        let deletion;
        let deleted;
        try {
            expect(created.ok).toBe(true);
            await withTimeout(barrier.arrived, 5_000, "barrier heartbeat did not start");

            deletion = realtime.request("deleteMonitor", created.monitorID, false);
            expect((await realtime.request("getMonitor", created.monitorID)).ok).toBe(true);
            deleted = await withTimeout(deletion, 2_500, "delete did not enforce the active heartbeat timeout");
        } finally {
            barrier.release();
        }

        expect(deleted.ok).toBe(true);
        expect((await realtime.request("getMonitor", created.monitorID)).ok).toBe(false);
        expect(
            realtime.events
                .slice(eventMark)
                .some((item) => item.event === "heartbeat" && item.args[0].monitorID === created.monitorID)
        ).toBe(false);
        expect(appLogs.slice(logMark).join("")).not.toMatch(
            /SQLITE_CONSTRAINT_FOREIGNKEY|FOREIGN KEY constraint failed/
        );
        targetBarrier = null;
    }, 15_000);

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
        expect(proxyRequests.some(({ url }) => url.endsWith("/first"))).toBe(true);
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
            const requestsBeforeReload = {
                assigned: proxyRequests.length,
                env: envProxyRequests.length,
                target: targetRequests.length,
            };
            await stopApp();
            await startApp();
            await login();
            await withTimeout(
                (async () => {
                    while (proxyRequests.length === requestsBeforeReload.assigned) {
                        await Bun.sleep(25);
                    }
                })(),
                5_000,
                `active monitor did not resume after reload ${restart + 1}`
            );
            expect(proxyRequests.length).toBeGreaterThan(requestsBeforeReload.assigned);
            expect(envProxyRequests.length).toBe(requestsBeforeReload.env);
            expect(targetRequests.length).toBeGreaterThan(requestsBeforeReload.target);
            expect(proxyRequests.at(-1).url.endsWith("/edited")).toBe(true);
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

    test("proxy saves validate endpoints and authentication without mutating rejected updates", async () => {
        const validCases = [
            ["http", "proxy.example"],
            ["https", "127.0.0.1"],
            ["socks", "::1"],
            ["socks5", "[2001:db8::1]"],
            ["socks5h", "localhost"],
            ["socks4", "proxy.internal"],
        ];
        const validIDs = [];
        for (const [protocol, host] of validCases) {
            const response = await realtime.request(
                "addProxy",
                { protocol, host, port: 1080, auth: false, active: true, default: false },
                null
            );
            expect(response.ok).toBe(true);
            validIDs.push(response.id);
        }

        let proxyList = await reconnectAndGetProxyList();
        expect(proxyList.find((proxy) => proxy.id === validIDs[2]).host).toBe("::1");
        expect(proxyList.find((proxy) => proxy.id === validIDs[3]).host).toBe("2001:db8::1");

        for (const protocol of [null, "HTTP", "ftp"]) {
            const response = await realtime.request(
                "addProxy",
                { protocol, host: "proxy.example", port: 8080, auth: false, active: true },
                null
            );
            expect(response.ok).toBe(false);
            expect(response.msg).toMatch(/unsupported proxy protocol/i);
        }

        for (const host of [
            "",
            " proxy.example",
            "proxy.example ",
            "proxy host",
            "http://proxy.example",
            "proxy.example/path",
            "user@proxy.example",
            "proxy.example:8080",
            "bad:host",
            "bad..host",
            "[not-ipv6]",
        ]) {
            const response = await realtime.request(
                "addProxy",
                { protocol: "http", host, port: 8080, auth: false, active: true },
                null
            );
            expect(response.ok).toBe(false);
            expect(response.msg).toMatch(/proxy host/i);
        }

        for (const port of [null, "8080", 0, -1, 1.5, 65536]) {
            const response = await realtime.request(
                "addProxy",
                { protocol: "http", host: "proxy.example", port, auth: false, active: true },
                null
            );
            expect(response.ok).toBe(false);
            expect(response.msg).toMatch(/proxy port/i);
        }

        for (const [username, password] of [
            ["", "secret"],
            ["user", ""],
            [null, "secret"],
            ["user", null],
        ]) {
            const response = await realtime.request(
                "addProxy",
                { protocol: "http", host: "proxy.example", port: 8080, auth: true, username, password, active: true },
                null
            );
            expect(response.ok).toBe(false);
            expect(response.msg).toMatch(/username and password/i);
        }

        const inactive = await realtime.request(
            "addProxy",
            {
                protocol: "http",
                host: "inactive.example",
                port: 8080,
                auth: false,
                username: "stale-user",
                password: "stale-password",
                active: false,
            },
            null
        );
        expect(inactive.ok).toBe(true);
        proxyList = await reconnectAndGetProxyList();
        expect(proxyList.find((proxy) => proxy.id === inactive.id)).toMatchObject({
            active: 0,
            username: null,
            password: null,
        });

        const authenticated = await realtime.request(
            "addProxy",
            {
                protocol: "http",
                host: "auth.example",
                port: 8080,
                auth: true,
                username: "u%@:/żółw",
                password: "p%@:/密碼",
                active: true,
            },
            null
        );
        expect(authenticated.ok).toBe(true);
        proxyList = await reconnectAndGetProxyList();
        expect(proxyList.find((proxy) => proxy.id === authenticated.id)).toMatchObject({
            username: "u%@:/żółw",
            password: "p%@:/密碼",
        });

        const unchanged = await realtime.request(
            "addProxy",
            { protocol: "http", host: "unchanged.example", port: 8080, auth: false, active: true },
            null
        );
        expect(unchanged.ok).toBe(true);
        const rejectedUpdate = await realtime.request(
            "addProxy",
            { protocol: "http", host: "http://mutated.example", port: 3128, auth: false, active: false },
            unchanged.id
        );
        expect(rejectedUpdate.ok).toBe(false);
        proxyList = await reconnectAndGetProxyList();
        expect(proxyList.find((proxy) => proxy.id === unchanged.id)).toMatchObject({
            host: "unchanged.example",
            port: 8080,
            active: 1,
        });

        const deactivated = await realtime.request(
            "addProxy",
            { protocol: "http", host: "deactivated.example", port: 3128, auth: false, active: false },
            unchanged.id
        );
        expect(deactivated.ok).toBe(true);
        proxyList = await reconnectAndGetProxyList();
        expect(proxyList.find((proxy) => proxy.id === unchanged.id)).toMatchObject({
            host: "deactivated.example",
            port: 3128,
            active: 0,
        });
    }, 30_000);

    test("core HTTP monitor saves reject unavailable proxies before persistence", async () => {
        const activeHttp = await realtime.request(
            "addProxy",
            { protocol: "http", host: "127.0.0.1", port: proxyServer.address().port, auth: false, active: true },
            null
        );
        const inactiveHttp = await realtime.request(
            "addProxy",
            { protocol: "http", host: "127.0.0.1", port: proxyServer.address().port, auth: false, active: false },
            null
        );
        const socks = await realtime.request(
            "addProxy",
            {
                protocol: "socks5h",
                host: "127.0.0.1",
                port: 1080,
                auth: true,
                username: "socks-user%@:/żółw",
                password: "socks-password%@:/密碼",
                active: true,
            },
            null
        );
        const httpsProxy = await realtime.request(
            "addProxy",
            { protocol: "https", host: "127.0.0.1", port: 8443, auth: false, active: true },
            null
        );
        for (const response of [activeHttp, inactiveHttp, socks, httpsProxy]) {
            expect(response.ok).toBe(true);
        }
        const foreignProxyID = insertForeignProxy(proxyServer.address().port);
        const missingProxyID = 2_147_483_646;
        const networkBefore = [proxyRequests.length, envProxyRequests.length, targetRequests.length];

        for (const type of ["http", "keyword", "json-query"]) {
            for (const [proxyId, message] of [
                [missingProxyID, /proxy.*unavailable/i],
                [foreignProxyID, /proxy.*unavailable/i],
                [inactiveHttp.id, /proxy.*inactive/i],
                [socks.id, /SOCKS.*not supported/i],
            ]) {
                const response = await realtime.request("add", monitorPayload({ type, proxyId, active: false }));
                expect(response.ok).toBe(false);
                expect(response.msg).toMatch(message);
            }
            const tlsResponse = await realtime.request(
                "add",
                monitorPayload({ type, proxyId: httpsProxy.id, ignoreTls: true, active: false })
            );
            expect(tlsResponse.ok).toBe(false);
            expect(tlsResponse.msg).toMatch(/ignore TLS.*HTTPS proxy.*not supported/i);
        }

        const created = await realtime.request("add", monitorPayload({ proxyId: activeHttp.id, active: false }));
        expect(created.ok).toBe(true);
        const before = (await realtime.request("getMonitor", created.monitorID)).monitor;
        for (const [type, proxyId, ignoreTls, message] of [
            ["http", missingProxyID, false, /proxy.*unavailable/i],
            ["keyword", foreignProxyID, false, /proxy.*unavailable/i],
            ["json-query", inactiveHttp.id, false, /proxy.*inactive/i],
            ["http", socks.id, false, /SOCKS.*not supported/i],
            ["http", httpsProxy.id, true, /ignore TLS.*HTTPS proxy.*not supported/i],
        ]) {
            const response = await realtime.request("editMonitor", {
                ...before,
                type,
                proxyId,
                ignoreTls,
            });
            expect(response.ok).toBe(false);
            expect(response.msg).toMatch(message);
            expect((await realtime.request("getMonitor", created.monitorID)).monitor).toMatchObject({
                type: before.type,
                proxyId: before.proxyId,
                ignoreTls: before.ignoreTls,
                url: before.url,
            });
        }
        expect([proxyRequests.length, envProxyRequests.length, targetRequests.length]).toEqual(networkBefore);
        expect((await realtime.request("deleteMonitor", created.monitorID, false)).ok).toBe(true);
    }, 30_000);

    test("invalid existing assignments stay stored and fail redacted without direct fallback", async () => {
        const activeHttp = await realtime.request(
            "addProxy",
            { protocol: "http", host: "127.0.0.1", port: proxyServer.address().port, auth: false, active: true },
            null
        );
        const inactiveHttp = await realtime.request(
            "addProxy",
            { protocol: "http", host: "127.0.0.1", port: proxyServer.address().port, auth: false, active: false },
            null
        );
        const socks = await realtime.request(
            "addProxy",
            {
                protocol: "socks5h",
                host: "127.0.0.1",
                port: 1080,
                auth: true,
                username: "socks-user%@:/żółw",
                password: "socks-password%@:/密碼",
                active: true,
            },
            null
        );
        const httpsProxy = await realtime.request(
            "addProxy",
            { protocol: "https", host: "127.0.0.1", port: 8443, auth: false, active: true },
            null
        );
        for (const response of [activeHttp, inactiveHttp, socks, httpsProxy]) {
            expect(response.ok).toBe(true);
        }
        const foreignProxyID = insertForeignProxy(proxyServer.address().port);
        const missingProxyID = 2_147_483_645;
        const created = await realtime.request("add", monitorPayload({ proxyId: activeHttp.id }));
        expect(created.ok).toBe(true);
        await realtime.waitFor("heartbeat", heartbeatFor(created.monitorID, 1));
        await stopApp();

        const cases = [
            [socks.id, false, /SOCKS.*not supported/i],
            [inactiveHttp.id, false, /proxy.*inactive/i],
            [missingProxyID, false, /proxy.*unavailable/i],
            [foreignProxyID, false, /proxy.*unavailable/i],
            [httpsProxy.id, true, /ignore TLS.*HTTPS proxy.*not supported/i],
        ];
        for (const [proxyID, ignoreTls, message] of cases) {
            updateMonitorAssignment(created.monitorID, proxyID, { ignoreTls });
            const before = {
                assigned: proxyRequests.length,
                env: envProxyRequests.length,
                target: targetRequests.length,
                logs: appLogs.length,
            };
            await startApp();
            await login();
            const [heartbeat] = await realtime.waitFor("heartbeat", heartbeatFor(created.monitorID, 0));
            expect(heartbeat.msg).toMatch(message);
            expect((await realtime.request("getMonitor", created.monitorID)).monitor.proxyId).toBe(proxyID);
            expect(proxyRequests.length).toBe(before.assigned);
            expect(envProxyRequests.length).toBe(before.env);
            expect(targetRequests.length).toBe(before.target);
            await Bun.sleep(50);
            const phaseLogs = appLogs.slice(before.logs).join("");
            expect(phaseLogs).toMatch(message);
            for (const secret of [
                "socks-user%@:/żółw",
                "socks-password%@:/密碼",
                encodeURIComponent("socks-password%@:/密碼"),
                "foreign-user%@:/żółw",
                "foreign-password%@:/密碼",
                Buffer.from("foreign-user%@:/żółw:foreign-password%@:/密碼").toString("base64"),
            ]) {
                expect(phaseLogs).not.toContain(secret);
            }
            await stopApp();
        }

        updateMonitorAssignment(created.monitorID, null);
        await startApp();
        await login();
        expect((await realtime.request("deleteMonitor", created.monitorID, false)).ok).toBe(true);
        const allLogs = appLogs.join("");
        expect(allLogs).toContain("Fetch Options prepared (proxy: true)");
        for (const basicValue of [
            `Basic ${Buffer.from("socks-user%@:/żółw:socks-password%@:/密碼").toString("base64")}`,
            `Basic ${Buffer.from("foreign-user%@:/żółw:foreign-password%@:/密碼").toString("base64")}`,
        ]) {
            expect(allLogs).not.toContain(basicValue);
        }
    }, 60_000);
});
