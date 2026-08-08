import { describe, expect, mock, test } from "bun:test";
import { createCloudflaredRuntime } from "@/server/socket-handlers/cloudflared-socket-handler";
import { getWebpushVapidPublicKey } from "@/server/webpush-vapid";

describe("optional startup integrations", () => {
    test("reuses an existing Web Push public key without loading web-push", async () => {
        const loadWebpush = mock(async () => {
            throw new Error("web-push should not load");
        });
        const settings = {
            get: async () => "existing-public-key",
            set: mock(async () => {}),
        };

        expect(await getWebpushVapidPublicKey(settings, loadWebpush)).toBe("existing-public-key");
        expect(loadWebpush).not.toHaveBeenCalled();
        expect(settings.set).not.toHaveBeenCalled();
    });

    test("loads web-push once to generate and persist missing VAPID keys", async () => {
        const writes: Array<[string, string]> = [];
        const generateVAPIDKeys = mock(() => ({ publicKey: "new-public-key", privateKey: "new-private-key" }));
        const loadWebpush = mock(async () => ({ default: { generateVAPIDKeys } }));
        const settings = {
            get: async () => undefined,
            set: async (key, value) => writes.push([key, value]),
        };

        expect(await getWebpushVapidPublicKey(settings, loadWebpush)).toBe("new-public-key");
        expect(loadWebpush).toHaveBeenCalledTimes(1);
        expect(generateVAPIDKeys).toHaveBeenCalledTimes(1);
        expect(writes).toEqual([
            ["webpushPublicVapidKey", "new-public-key"],
            ["webpushPrivateVapidKey", "new-private-key"],
        ]);
    });

    test("shares one VAPID key pair across concurrent missing-key requests", async () => {
        const writes: Array<[string, string]> = [];
        const generateVAPIDKeys = mock(() => ({ publicKey: "shared-public-key", privateKey: "shared-private-key" }));
        const loadWebpush = mock(async () => ({ default: { generateVAPIDKeys } }));
        const settings = {
            get: async () => undefined,
            set: async (key: string, value: string) => {
                await Bun.sleep(1);
                writes.push([key, value]);
            },
        };

        const keys = await Promise.all([
            getWebpushVapidPublicKey(settings, loadWebpush),
            getWebpushVapidPublicKey(settings, loadWebpush),
        ]);

        expect(keys).toEqual(["shared-public-key", "shared-public-key"]);
        expect(loadWebpush).toHaveBeenCalledTimes(1);
        expect(generateVAPIDKeys).toHaveBeenCalledTimes(1);
        expect(writes).toEqual([
            ["webpushPublicVapidKey", "shared-public-key"],
            ["webpushPrivateVapidKey", "shared-private-key"],
        ]);
    });

    test("does not load cloudflared until a socket action needs it and reuses the instance", async () => {
        const handlers = new Map<string, (...args: unknown[]) => unknown>();
        const values = new Map<string, unknown>([
            ["cloudflaredTunnelToken", ""],
            ["disableAuth", true],
        ]);
        const emissions: Array<[string | number, string, unknown]> = [];
        const settings = {
            get: async (key: string) => values.get(key),
            set: async (key: string, value: unknown) => values.set(key, value),
        };
        const io = {
            to: (room: string | number) => ({
                emit: (event: string, value: unknown) => emissions.push([room, event, value]),
            }),
        };
        const socket = {
            userID: 1,
            join: mock(() => {}),
            leave: mock(() => {}),
            on: (event: string, handler: (...args: unknown[]) => unknown) => handlers.set(event, handler),
        };
        const instances: CloudflaredTunnel[] = [];
        class CloudflaredTunnel {
            token: string | null = null;
            running = false;
            start = mock(() => {});
            stop = mock(() => {});
            checkInstalled = mock(() => true);

            constructor() {
                instances.push(this);
            }
        }
        const loadCloudflared = mock(async () => ({ CloudflaredTunnel }));
        const runtime = createCloudflaredRuntime(io, settings, loadCloudflared);

        runtime.socketHandler(socket, {});
        await runtime.autoStart();
        await runtime.stop();
        expect(loadCloudflared).not.toHaveBeenCalled();

        await handlers.get("cloudflared_join")?.();
        expect(loadCloudflared).toHaveBeenCalledTimes(1);
        expect(instances).toHaveLength(1);
        expect(socket.join).toHaveBeenCalledWith("cloudflared");
        expect(emissions).toContainEqual([1, "cloudflared_installed", true]);

        await handlers.get("cloudflared_start")?.("token-value");
        expect(loadCloudflared).toHaveBeenCalledTimes(1);
        expect(instances[0].token).toBe("token-value");
        expect(instances[0].start).toHaveBeenCalledTimes(1);

        await handlers.get("cloudflared_stop")?.("unused-password", () => {});
        await runtime.stop();
        expect(loadCloudflared).toHaveBeenCalledTimes(1);
        expect(instances[0].stop).toHaveBeenCalledTimes(2);
    });

    test("auto-start checks the token before loading cloudflared", async () => {
        const writes: Array<[string, string]> = [];
        let tunnel: CloudflaredTunnel | undefined;
        class CloudflaredTunnel {
            token: string | null = null;
            start = mock(() => {});
            stop = mock(() => {});

            constructor() {
                tunnel = this;
            }
        }
        const loadCloudflared = mock(async () => ({ CloudflaredTunnel }));
        const settings = {
            get: mock(async () => {
                throw new Error("argument token should be used");
            }),
            set: async (key: string, value: string) => writes.push([key, value]),
        };
        const runtime = createCloudflaredRuntime({ to: () => ({ emit() {} }) }, settings, loadCloudflared);

        await runtime.autoStart("argument-token");

        expect(loadCloudflared).toHaveBeenCalledTimes(1);
        expect(settings.get).not.toHaveBeenCalled();
        expect(writes).toEqual([["cloudflaredTunnelToken", "argument-token"]]);
        expect(tunnel?.token).toBe("argument-token");
        expect(tunnel?.start).toHaveBeenCalledTimes(1);
    });

    test("failed cloudflared loads do not join a room, poison retries, or block shutdown", async () => {
        const handlers = new Map<string, (...args: unknown[]) => unknown>();
        const join = mock(() => {});
        const socket = {
            userID: 1,
            join,
            leave() {},
            on: (event: string, handler: (...args: unknown[]) => unknown) => handlers.set(event, handler),
        };
        class CloudflaredTunnel {
            running = false;
            checkInstalled = () => true;
        }
        let attempts = 0;
        const loadCloudflared = mock(async () => {
            attempts++;
            if (attempts === 1) {
                throw new Error("load failed");
            }
            return { CloudflaredTunnel };
        });
        const runtime = createCloudflaredRuntime(
            { to: () => ({ emit() {} }) },
            { get: async () => "", set: async () => {} },
            loadCloudflared
        );
        runtime.socketHandler(socket, {});

        await handlers.get("cloudflared_join")?.();
        expect(join).not.toHaveBeenCalled();
        await expect(runtime.stop()).resolves.toBeUndefined();

        await handlers.get("cloudflared_join")?.();
        expect(loadCloudflared).toHaveBeenCalledTimes(2);
        expect(join).toHaveBeenCalledTimes(1);
    });
});
