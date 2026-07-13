// @ts-nocheck

import { afterEach, describe, expect, test } from "bun:test";
import { BunRealtimeAdapter } from "@/server/bun-websocket-server";
import { PocketKumaServer } from "@/server/pocketkuma-server";
import { Settings } from "@/server/settings";

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
});
