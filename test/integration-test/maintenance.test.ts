// @ts-nocheck

import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const projectRoot = path.join(import.meta.dirname, "../..");
const binaryPath = process.env.POCKETKUMA_BINARY ? path.resolve(projectRoot, process.env.POCKETKUMA_BINARY) : null;
let appProcess;
let dataDir;
let sockets = [];

function reservePort() {
    const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
    const port = listener.port;
    listener.stop(true);
    return port;
}

async function startApp() {
    const port = reservePort();
    const command = binaryPath
        ? [binaryPath, `--port=${port}`, "--host=127.0.0.1", `--data-dir=${dataDir}`]
        : [process.execPath, "src/server/server.ts", `--port=${port}`, "--host=127.0.0.1", `--data-dir=${dataDir}`];
    appProcess = Bun.spawn(command, {
        cwd: projectRoot,
        env: { ...process.env, NODE_ENV: "production", UPTIME_KUMA_WS_ORIGIN_CHECK: "bypass" },
        stdout: "ignore",
        stderr: "ignore",
    });
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
        if (appProcess.exitCode !== null) {
            throw new Error(`PocketKuma exited with ${appProcess.exitCode}`);
        }
        try {
            if ((await fetch(`http://127.0.0.1:${port}`)).ok) {
                return port;
            }
        } catch {}
        await Bun.sleep(50);
    }
    throw new Error("PocketKuma did not start");
}

async function stopApp() {
    for (const socket of sockets.splice(0)) {
        socket.close();
    }
    if (appProcess?.exitCode === null) {
        appProcess.kill("SIGTERM");
        await Promise.race([
            appProcess.exited,
            Bun.sleep(5_000).then(() => {
                throw new Error("PocketKuma did not stop");
            }),
        ]);
    }
    appProcess = null;
}

async function connect(port) {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    sockets.push(socket);
    const callbacks = new Map();
    const events = new Map();
    let nextID = 1;
    const ready = new Promise((resolve, reject) => {
        socket.addEventListener("error", () => reject(new Error("WebSocket connection failed")), { once: true });
        socket.addEventListener("message", (event) => {
            const message = JSON.parse(String(event.data));
            if (message.type === "event") {
                if (message.event === "loginRequired" || message.event === "autoLogin") {
                    resolve();
                }
                const waiters = events.get(message.event) || [];
                events.set(message.event, []);
                waiters.forEach((waiter) => waiter(message.args?.[0]));
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
    await Promise.race([
        ready,
        Bun.sleep(10_000).then(() => {
            throw new Error("WebSocket was not ready");
        }),
    ]);
    return {
        request(event, ...args) {
            const id = String(nextID++);
            const reply = new Promise((resolve, reject) => callbacks.set(id, { resolve, reject }));
            socket.send(JSON.stringify({ type: "event", event, args, id }));
            return Promise.race([
                reply,
                Bun.sleep(10_000).then(() => {
                    throw new Error(`No reply for ${event}`);
                }),
            ]);
        },
        nextEvent(name) {
            return new Promise((resolve) => events.set(name, [...(events.get(name) || []), resolve]));
        },
    };
}

function maintenance() {
    return {
        title: "Owner-only maintenance",
        description: "private schedule",
        active: true,
        strategy: "manual",
        intervalDay: 1,
        timezoneOption: "UTC",
        dateRange: [null, null],
        timeRange: [
            { hours: 10, minutes: 0 },
            { hours: 11, minutes: 0 },
        ],
        weekdays: [],
        daysOfMonth: [],
        durationMinutes: 60,
        cron: "0 10 * * *",
    };
}

afterEach(async () => {
    await stopApp();
    if (dataDir) {
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
});

describe("maintenance ownership boundaries", () => {
    test("keeps schedules and every mutation scoped to their owner", async () => {
        dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pocketkuma-maintenance-"));
        let port = await startApp();
        const bootstrap = await connect(port);
        expect((await bootstrap.request("setup", "owner", "owner-password")).ok).toBe(true);
        await stopApp();

        const db = new Database(path.join(dataDir, "kuma.db"));
        const ownerID = db.query("SELECT id FROM user WHERE username = ?").get("owner").id;
        db.query("INSERT INTO user (username, password, active) VALUES (?, ?, ?)").run(
            "other",
            await Bun.password.hash("other-password", { algorithm: "argon2id" }),
            1
        );
        db.query(
            "INSERT INTO monitor (name, active, user_id, interval, type, kafka_producer_brokers, kafka_producer_sasl_options, rabbitmq_nodes, conditions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run("Owner monitor", 1, ownerID, 60, "manual", "[]", "{}", "[]", "[]");
        const monitorID = db.query("SELECT id FROM monitor WHERE user_id = ?").get(ownerID).id;
        db.close();

        port = await startApp();
        const owner = await connect(port);
        const other = await connect(port);
        expect((await owner.request("login", { username: "owner", password: "owner-password", token: "" })).ok).toBe(
            true
        );
        expect((await other.request("login", { username: "other", password: "other-password", token: "" })).ok).toBe(
            true
        );
        const created = await owner.request("addMaintenance", maintenance());
        expect(created).toEqual({ ok: true, msg: "successAdded", msgi18n: true, maintenanceID: expect.any(Number) });
        const id = created.maintenanceID;
        expect((await owner.request("addMonitorMaintenance", id, [{ id: monitorID }])).ok).toBe(true);

        for (const schedule of [
            { ...maintenance(), title: "Cron", strategy: "cron", cron: "0 10 * * *", durationMinutes: 15 },
            {
                ...maintenance(),
                title: "Interval",
                strategy: "recurring-interval",
                dateRange: ["2026-01-01T00:00", "2026-12-31T23:59"],
                timeRange: [
                    { hours: 10, minutes: 0 },
                    { hours: 10, minutes: 30 },
                ],
            },
            {
                ...maintenance(),
                title: "Weekday",
                strategy: "recurring-weekday",
                dateRange: ["2026-01-01T00:00", "2026-12-31T23:59"],
                timeRange: [
                    { hours: 10, minutes: 0 },
                    { hours: 10, minutes: 30 },
                ],
                weekdays: [1],
            },
            {
                ...maintenance(),
                title: "Day of month",
                strategy: "recurring-day-of-month",
                dateRange: ["2026-01-01T00:00", "2026-12-31T23:59"],
                timeRange: [
                    { hours: 10, minutes: 0 },
                    { hours: 10, minutes: 30 },
                ],
                daysOfMonth: [1, "lastDay1"],
            },
        ]) {
            expect(await owner.request("addMaintenance", schedule)).toMatchObject({ ok: true });
        }

        const list = other.nextEvent("maintenanceList");
        expect((await other.request("getMaintenanceList")).ok).toBe(true);
        expect(await list).toEqual({});
        for (const [event, args] of [
            ["getMaintenance", [id]],
            ["getMonitorMaintenance", [id]],
            ["addMonitorMaintenance", [id, []]],
            ["addMaintenanceStatusPage", [id, []]],
            ["pauseMaintenance", [id]],
            ["resumeMaintenance", [id]],
            ["deleteMaintenance", [id]],
        ]) {
            expect((await other.request(event, ...args)).ok).toBe(false);
        }

        expect((await owner.request("getMaintenance", id)).maintenance.title).toBe("Owner-only maintenance");
        expect((await owner.request("getMonitorMaintenance", id)).monitors).toEqual([{ id: monitorID }]);
    }, 120_000);
});
