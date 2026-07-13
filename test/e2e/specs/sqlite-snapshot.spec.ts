// @ts-nocheck

import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { login, restoreSqliteSnapshot, serverUrl } from "../util-test";

const dataDir = path.join(import.meta.dirname, "../../../data/playwright-test");
const errorLogPath = path.join(dataDir, "error.log");
const snapshotPath = path.join(dataDir, "kuma.db.e2e-snapshot");

function readErrorLog() {
    return fs.existsSync(errorLogPath) ? fs.readFileSync(errorLogPath, "utf8") : "";
}

async function startHeartbeatBarrier() {
    let arrive;
    let release;
    let blocked = true;
    const arrived = new Promise((resolve) => {
        arrive = resolve;
    });
    const released = new Promise((resolve) => {
        release = resolve;
    });
    const server = http.createServer(async (_request, response) => {
        arrive();
        if (blocked) {
            await released;
        }
        response.writeHead(200, { "Content-Type": "text/plain" });
        response.end("heartbeat released");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    return {
        arrived,
        release() {
            blocked = false;
            release();
        },
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((resolve) => server.close(resolve)),
    };
}

async function snapshotPhase() {
    const response = await fetch(`${serverUrl}/_e2e/sqlite-snapshot-state`);
    if (!response.headers.get("content-type")?.includes("application/json")) {
        return "missing";
    }
    return (await response.json()).phase;
}

test.describe("SQLite E2E snapshot isolation", () => {
    test.beforeEach(async () => {
        const response = await restoreSqliteSnapshot();
        expect(response.ok).toBe(true);
    });

    test("waits for an active heartbeat and reloads runtime state before responding", async ({ page }) => {
        const barrier = await startHeartbeatBarrier();
        const pageErrors = [];
        const consoleErrors = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("console", (message) => {
            if (message.type() === "error") {
                consoleErrors.push(message.text());
            }
        });
        const errorsBefore = readErrorLog();

        try {
            await page.goto("./add-status-page");
            await login(page);
            await page.getByTestId("name-input").fill("Snapshot cache page");
            await page.getByTestId("slug-input").fill("snapshot-cache");
            await page.getByTestId("submit-button").click();
            await page.waitForURL("/status/snapshot-cache?edit");
            expect((await fetch(`${serverUrl}/api/status-page/snapshot-cache`)).ok).toBe(true);

            await page.goto("./add-maintenance");
            await page.locator("#name").fill("Snapshot timer maintenance");
            await page.locator("#strategy").selectOption("single");
            await page.locator("#show-on-all-pages").check();
            const localDateTime = (offsetMinutes) => {
                const value = new Date(Date.now() + offsetMinutes * 60_000);
                return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
            };
            await page.locator("input[type='datetime-local']").nth(0).fill(localDateTime(5));
            await page.locator("input[type='datetime-local']").nth(1).fill(localDateTime(10));
            await page.locator("#monitor-submit-btn").click();
            await page.getByRole("button", { name: "Yes" }).click();
            await page.waitForURL("/maintenance");

            await page.goto("./add");
            await page.getByTestId("monitor-type-select").selectOption("http");
            await page.getByTestId("friendly-name-input").fill("Snapshot barrier monitor");
            await page.getByTestId("url-input").fill(barrier.url);
            await page.getByTestId("save-button").click();
            await page.waitForURL("/dashboard/*");
            await barrier.arrived;

            let restored = 0;
            const restorations = Array.from({ length: 5 }, () =>
                restoreSqliteSnapshot().then((response) => {
                    restored++;
                    return response;
                })
            );
            await expect.poll(snapshotPhase).toBe("quiescing");
            expect(restored).toBe(0);

            barrier.release();
            expect((await Promise.all(restorations)).every((response) => response.ok)).toBe(true);
            await expect.poll(snapshotPhase).toBe("idle");

            await page.goto("./dashboard");
            await login(page);
            await expect(page.getByText("Snapshot barrier monitor", { exact: true })).toHaveCount(0);
            expect((await fetch(`${serverUrl}/api/status-page/snapshot-cache`)).status).toBe(404);

            await page.goto("./maintenance");
            await expect(page.getByText("Snapshot timer maintenance", { exact: true })).toHaveCount(0);

            await page.goto("./add");
            await page.getByTestId("monitor-type-select").selectOption("manual");
            await page.getByTestId("friendly-name-input").fill("Monitor after snapshot restore");
            await page.getByTestId("save-button").click();
            await page.waitForURL("/dashboard/*");
            await expect(page.getByText("Monitor after snapshot restore", { exact: true })).toBeVisible();

            expect(readErrorLog()).toBe(errorsBefore);
            expect(pageErrors).toEqual([]);
            expect(consoleErrors).toEqual([]);
        } finally {
            barrier.release();
            await barrier.close();
        }
    });

    test("serializes 100 concurrent restores without backend errors", async () => {
        test.setTimeout(120_000);
        const errorsBefore = readErrorLog();
        const responses = [];

        for (let batch = 0; batch < 20; batch++) {
            responses.push(...(await Promise.all(Array.from({ length: 5 }, () => restoreSqliteSnapshot()))));
        }

        expect(responses).toHaveLength(100);
        expect(responses.every((response) => response.ok)).toBe(true);
        expect(await Promise.all(responses.map((response) => response.text()))).toEqual(
            Array.from({ length: 100 }, () => "Snapshot restored.")
        );
        expect(readErrorLog()).toBe(errorsBefore);
        expect(await snapshotPhase()).toBe("idle");
    });

    test("rejects missing and invalid snapshots without taking the service down", async () => {
        const validSnapshot = fs.readFileSync(snapshotPath);
        const movedSnapshot = `${snapshotPath}.test-missing`;

        try {
            fs.renameSync(snapshotPath, movedSnapshot);
            expect((await restoreSqliteSnapshot()).status).toBe(500);
            expect((await fetch(`${serverUrl}/api/entry-page`)).ok).toBe(true);
            fs.renameSync(movedSnapshot, snapshotPath);

            fs.writeFileSync(snapshotPath, "not a sqlite database");
            expect((await restoreSqliteSnapshot()).status).toBe(500);
            expect((await fetch(`${serverUrl}/api/entry-page`)).ok).toBe(true);

            fs.writeFileSync(snapshotPath, validSnapshot);
            const malformed = spawnSync(
                "bun",
                [
                    "-e",
                    'import { Database } from "bun:sqlite"; const db = new Database(process.argv[1]); db.run("DROP TABLE setting"); db.run("CREATE TABLE setting (id INTEGER PRIMARY KEY)"); db.close();',
                    snapshotPath,
                ],
                { encoding: "utf8" }
            );
            expect(malformed.status, malformed.stderr).toBe(0);
            expect((await restoreSqliteSnapshot()).status).toBe(500);
            expect((await fetch(`${serverUrl}/api/entry-page`)).ok).toBe(true);
            expect(await snapshotPhase()).toBe("idle");
        } finally {
            if (fs.existsSync(movedSnapshot)) {
                fs.renameSync(movedSnapshot, snapshotPath);
            }
            fs.writeFileSync(snapshotPath, validSnapshot);
        }

        expect((await restoreSqliteSnapshot()).ok).toBe(true);
    });
});
