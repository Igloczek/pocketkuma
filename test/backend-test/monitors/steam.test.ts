// @ts-nocheck

import { describe, test, expect } from "bun:test";
import { SteamMonitorType } from "../../../src/server/monitor-types/steam.ts";
import { UP, PENDING } from "../../../src/util.ts";

describe("Steam Monitor", () => {
    test("resolveSteamHostname() returns IP addresses without DNS lookup", async () => {
        let lookupCalled = false;
        const steamMonitor = new SteamMonitorType({
            lookup: async () => {
                lookupCalled = true;
            },
        });

        expect(await steamMonitor.resolveSteamHostname("192.0.2.10")).toBe("192.0.2.10");
        expect(await steamMonitor.resolveSteamHostname("2001:db8::10")).toBe("2001:db8::10");
        expect(lookupCalled).toBe(false);
    });

    test("buildServerFilter() resolves hostnames before building the Steam API addr filter", async () => {
        let capturedHostname = null;
        let capturedOptions = null;
        const steamMonitor = new SteamMonitorType({
            lookup: async (hostname, options) => {
                capturedHostname = hostname;
                capturedOptions = options;
                return [
                    {
                        address: "203.0.113.10",
                        family: 4,
                    },
                ];
            },
        });

        const filter = await steamMonitor.buildServerFilter("server.example.com", 27015);

        expect(filter).toBe("addr\\203.0.113.10:27015");
        expect(capturedHostname).toBe("server.example.com");
        expect(capturedOptions).toEqual({ all: true });
    });

    test("resolveSteamHostname() prefers IPv4 addresses returned by DNS lookup", async () => {
        const steamMonitor = new SteamMonitorType({
            lookup: async () => {
                return [
                    {
                        address: "2001:db8::20",
                        family: 6,
                    },
                    {
                        address: "203.0.113.20",
                        family: 4,
                    },
                ];
            },
        });

        expect(await steamMonitor.resolveSteamHostname("server.example.com")).toBe("203.0.113.20");
    });

    test("check() uses the resolved IP address in the Steam API filter", async () => {
        let capturedUrl = null;
        let capturedOptions = null;
        const steamMonitor = new SteamMonitorType({
            lookup: async () => {
                return [
                    {
                        address: "203.0.113.30",
                        family: 4,
                    },
                ];
            },
            getSteamAPIKey: async () => "test-steam-api-key",
            steamApiClient: {
                get: async (url, options) => {
                    capturedUrl = url;
                    capturedOptions = options;
                    return {
                        data: {
                            response: {
                                servers: [
                                    {
                                        name: "Test Steam Server",
                                    },
                                ],
                            },
                        },
                    };
                },
            },
            ping: async () => 42,
        });

        const monitor = {
            hostname: "server.example.com",
            port: 27015,
            timeout: 30,
            maxredirects: 10,
            packetSize: 56,
            getIgnoreTls: () => false,
            getAcceptedStatuscodes: () => ["200"],
        };
        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await steamMonitor.check(monitor, heartbeat);

        expect(capturedUrl).toBe("https://api.steampowered.com/IGameServersService/GetServerList/v1/");
        expect(capturedOptions.params.filter).toBe("addr\\203.0.113.30:27015");
        expect(capturedOptions.params.key).toBe("test-steam-api-key");
        expect(heartbeat.status).toBe(UP);
        expect(heartbeat.msg).toBe("Test Steam Server");
        expect(heartbeat.ping).toBe(42);
    });

    test("check() does not resolve hostnames when the Steam API key is missing", async () => {
        let lookupCalled = false;
        const steamMonitor = new SteamMonitorType({
            lookup: async () => {
                lookupCalled = true;
            },
            getSteamAPIKey: async () => "",
        });

        const monitor = {
            hostname: "server.example.com",
            port: 27015,
        };
        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await expect(steamMonitor.check(monitor, heartbeat)).rejects.toThrow(/Steam API Key not found/);
        expect(lookupCalled).toBe(false);
    });
});
