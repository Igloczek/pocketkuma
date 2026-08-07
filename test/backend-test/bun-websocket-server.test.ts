// @ts-nocheck

import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BunRealtimeAdapter } from "@/server/bun-websocket-server";
import { BunSQLiteRedbean } from "@/server/bun-sqlite-store";
import { PocketKumaServer } from "@/server/pocketkuma-server";
import { legacySettings, Settings } from "@/server/settings-legacy";

const realSettingsGet = Settings.get;

afterEach(() => {
    Settings.get = realSettingsGet;
});

async function upgrade({ peer, headers = {}, trustProxy = false }) {
    Settings.get = async () => trustProxy;
    const adapter = new BunRealtimeAdapter({
        getClientIPwithProxy: PocketKumaServer.prototype.getClientIPwithProxy,
    });
    let data;
    const upgraded = await adapter.canUpgrade(new Request("http://pocketkuma.test/ws", { headers }), {
        requestIP: () => (peer ? { address: peer } : undefined),
        upgrade: (_, options) => {
            data = options.data;
            return true;
        },
    });
    return { data, upgraded };
}

describe("Bun WebSocket client source", () => {
    test("uses the Bun peer and ignores spoofed forwarding headers without trustProxy", async () => {
        const { data, upgraded } = await upgrade({
            peer: "127.0.0.1",
            headers: {
                "x-forwarded-for": "203.0.113.9",
                "x-real-ip": "198.51.100.7",
            },
        });

        expect(upgraded).toBe(true);
        expect(data.remoteAddress).toBe("127.0.0.1");
    });

    test("uses configured forwarding headers when trustProxy is enabled", async () => {
        const { data } = await upgrade({
            peer: "127.0.0.1",
            headers: { "x-forwarded-for": "203.0.113.9, 198.51.100.7" },
            trustProxy: true,
        });

        expect(data.remoteAddress).toBe("203.0.113.9");
    });

    test("keeps the existing empty source when Bun cannot provide a peer", async () => {
        const { data } = await upgrade({
            headers: { "x-forwarded-for": "203.0.113.9", "x-real-ip": "198.51.100.7" },
        });

        expect(data.remoteAddress).toBe("");
    });

    test("shares trustProxy invalidation and snapshot cache clears with injected settings", async () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pocketkuma-settings-ws-"));
        const store = new BunSQLiteRedbean();
        const originalStore = Settings.store;
        const originalCache = Settings.cacheList;
        await store.connect({
            sqlitePath: path.join(directory, "kuma.db"),
            templatePath: path.join(process.cwd(), "src/db/kuma.db"),
            testMode: true,
        });

        try {
            Settings.stopCacheCleaner();
            Settings.store = store;
            Settings.cacheList = {};
            expect(legacySettings).toBe(Settings);

            const server = { getClientIPwithProxy: PocketKumaServer.prototype.getClientIPwithProxy };
            const forwardedHeaders = { "x-forwarded-for": "203.0.113.9" };
            await legacySettings.set("trustProxy", true);
            expect(await server.getClientIPwithProxy("127.0.0.1", forwardedHeaders)).toBe("203.0.113.9");

            await legacySettings.set("trustProxy", false);
            const adapter = new BunRealtimeAdapter(server);
            let remoteAddress;
            await adapter.canUpgrade(new Request("http://pocketkuma.test/ws", { headers: forwardedHeaders }), {
                requestIP: () => ({ address: "127.0.0.1" }),
                upgrade: (_, options) => {
                    remoteAddress = options.data.remoteAddress;
                    return true;
                },
            });
            expect(remoteAddress).toBe("127.0.0.1");

            await legacySettings.set("trustProxy", true);
            expect(await server.getClientIPwithProxy("127.0.0.1", forwardedHeaders)).toBe("203.0.113.9");
            await store.exec("UPDATE setting SET value = ? WHERE `key` = ?", [JSON.stringify(false), "trustProxy"]);
            legacySettings.cacheList = {};
            expect(await server.getClientIPwithProxy("127.0.0.1", forwardedHeaders)).toBe("127.0.0.1");
            remoteAddress = null;
            await adapter.canUpgrade(new Request("http://pocketkuma.test/ws", { headers: forwardedHeaders }), {
                requestIP: () => ({ address: "127.0.0.1" }),
                upgrade: (_, options) => {
                    remoteAddress = options.data.remoteAddress;
                    return true;
                },
            });
            expect(remoteAddress).toBe("127.0.0.1");
        } finally {
            Settings.stopCacheCleaner();
            Settings.store = originalStore;
            Settings.cacheList = originalCache;
            await store.close();
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });
});
