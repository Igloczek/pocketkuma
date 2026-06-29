// @ts-nocheck

import { describe, test, expect, spyOn } from "bun:test";
import { GameDigMonitorType } from "../../../src/server/monitor-types/gamedig.ts";
import { UP, PENDING } from "../../../src/util.ts";
import { GameDig } from "gamedig";

describe("GameDig Monitor", () => {
    test("check() sets status to UP when Gamedig.query returns valid server response", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        const querySpy = spyOn(GameDig, "query").mockImplementation(async () => {
            return {
                name: "Test Minecraft Server",
                ping: 42,
                players: [],
            };
        });

        const monitor = {
            hostname: "127.0.0.1",
            port: 25565,
            game: "minecraft",
            gamedigGivenPortOnly: true,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await gamedigMonitor.check(monitor, heartbeat, {});

            expect(heartbeat.status).toBe(UP);
            expect(heartbeat.msg).toBe("Test Minecraft Server");
            expect(heartbeat.ping).toBe(42);
        } finally {
            querySpy.mockRestore();
        }
    });

    test("check() passes hostname directly to GameDig when hostname is not an IP", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        let capturedOptions = null;

        const querySpy = spyOn(GameDig, "query").mockImplementation(async (options) => {
            capturedOptions = options;
            return {
                name: "Test Server",
                ping: 50,
            };
        });

        const monitor = {
            hostname: "localhost",
            port: 25565,
            game: "minecraft",
            gamedigGivenPortOnly: false,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await gamedigMonitor.check(monitor, heartbeat, {});

            expect(capturedOptions.host).toBe("localhost");
            expect(heartbeat.status).toBe(UP);
            expect(heartbeat.msg).toBe("Test Server");
            expect(heartbeat.ping).toBe(50);
        } finally {
            querySpy.mockRestore();
        }
    });

    test("check() passes IPv4 address directly to GameDig", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        let capturedOptions = null;

        const querySpy = spyOn(GameDig, "query").mockImplementation(async (options) => {
            capturedOptions = options;
            return {
                name: "Test Server",
                ping: 30,
            };
        });

        const monitor = {
            hostname: "192.168.1.100",
            port: 27015,
            game: "valve",
            gamedigGivenPortOnly: true,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await gamedigMonitor.check(monitor, heartbeat, {});

            expect(capturedOptions.host).toBe("192.168.1.100");
            expect(heartbeat.status).toBe(UP);
        } finally {
            querySpy.mockRestore();
        }
    });

    test("check() passes IPv6 address directly to GameDig", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        let capturedOptions = null;

        const querySpy = spyOn(GameDig, "query").mockImplementation(async (options) => {
            capturedOptions = options;
            return {
                name: "Test Server",
                ping: 30,
            };
        });

        const monitor = {
            hostname: "::1",
            port: 27015,
            game: "valve",
            gamedigGivenPortOnly: true,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await gamedigMonitor.check(monitor, heartbeat, {});

            expect(capturedOptions.host).toBe("::1");
            expect(heartbeat.status).toBe(UP);
        } finally {
            querySpy.mockRestore();
        }
    });

    test("check() passes correct parameters to Gamedig.query", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        let capturedOptions = null;

        const querySpy = spyOn(GameDig, "query").mockImplementation(async (options) => {
            capturedOptions = options;
            return {
                name: "Test Server",
                ping: 25,
            };
        });

        const monitor = {
            hostname: "192.168.1.100",
            port: 27015,
            game: "valve",
            gamedigGivenPortOnly: true,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await gamedigMonitor.check(monitor, heartbeat, {});

            expect(capturedOptions.type).toBe("valve");
            expect(capturedOptions.host).toBe("192.168.1.100");
            expect(capturedOptions.port).toBe(27015);
            expect(capturedOptions.givenPortOnly).toBe(true);
        } finally {
            querySpy.mockRestore();
        }
    });

    test("check() converts gamedigGivenPortOnly to boolean when value is truthy non-boolean", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        let capturedOptions = null;

        const querySpy = spyOn(GameDig, "query").mockImplementation(async (options) => {
            capturedOptions = options;
            return {
                name: "Test Server",
                ping: 30,
            };
        });

        const monitor = {
            hostname: "127.0.0.1",
            port: 25565,
            game: "minecraft",
            gamedigGivenPortOnly: 1,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await gamedigMonitor.check(monitor, heartbeat, {});

            expect(capturedOptions.givenPortOnly).toBe(true);
            expect(typeof capturedOptions.givenPortOnly).toBe("boolean");
        } finally {
            querySpy.mockRestore();
        }
    });

    test("check() rejects when game server is unreachable", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        const monitor = {
            hostname: "127.0.0.1",
            port: 54321,
            game: "minecraft",
            gamedigGivenPortOnly: true,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await expect(gamedigMonitor.check(monitor, heartbeat, {})).rejects.toThrow();
    });
});
