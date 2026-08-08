// @ts-nocheck

import { checkLogin } from "@/server/socket-auth";
import { doubleCheckPassword } from "@/server/server-auth-helpers";
import { log } from "@/server/logger";

const prefix = "cloudflared_";

export function createCloudflaredRuntime(io, settings, loadCloudflared = () => import("node-cloudflared-tunnel")) {
    let loading;

    const getCloudflared = async () => {
        if (!loading) {
            const pending = loadCloudflared().then(({ CloudflaredTunnel }) => {
                const cloudflared = new CloudflaredTunnel();
                cloudflared.change = (running, message) => {
                    io.to("cloudflared").emit(prefix + "running", running);
                    io.to("cloudflared").emit(prefix + "message", message);
                };
                cloudflared.error = (errorMessage) => io.to("cloudflared").emit(prefix + "errorMessage", errorMessage);
                return cloudflared;
            });
            loading = pending;
            void pending.then(undefined, () => {
                if (loading === pending) {
                    loading = undefined;
                }
            });
        }
        return loading;
    };

    const socketHandler = (socket, store) => {
        socket.on(prefix + "join", async () => {
            try {
                checkLogin(socket);
                const cloudflared = await getCloudflared();
                socket.join("cloudflared");
                io.to(socket.userID).emit(prefix + "installed", cloudflared.checkInstalled());
                io.to(socket.userID).emit(prefix + "running", cloudflared.running);
                io.to(socket.userID).emit(prefix + "token", await settings.get("cloudflaredTunnelToken"));
            } catch (error) {
                log.error("cloudflared", "Error in join handler: " + error.message);
            }
        });

        socket.on(prefix + "leave", () => {
            try {
                checkLogin(socket);
                socket.leave("cloudflared");
            } catch (error) {
                log.error("cloudflared", "Error in leave handler: " + error.message);
            }
        });

        socket.on(prefix + "start", async (token) => {
            try {
                checkLogin(socket);
                let nextToken = null;
                if (token && typeof token === "string") {
                    await settings.set("cloudflaredTunnelToken", token);
                    nextToken = token;
                }
                const cloudflared = await getCloudflared();
                cloudflared.token = nextToken;
                cloudflared.start();
            } catch (error) {
                log.error("cloudflared", "Error in start handler: " + error.message);
            }
        });

        socket.on(prefix + "stop", async (currentPassword, callback) => {
            try {
                checkLogin(socket);
                if (!(await settings.get("disableAuth"))) {
                    await doubleCheckPassword(store, socket, currentPassword);
                }
                const cloudflared = await getCloudflared();
                cloudflared.stop();
            } catch (error) {
                callback({ ok: false, msg: error.message });
            }
        });

        socket.on(prefix + "removeToken", async () => {
            try {
                checkLogin(socket);
                await settings.set("cloudflaredTunnelToken", "");
            } catch (error) {
                log.error("cloudflared", "Error in removeToken handler: " + error.message);
            }
        });
    };

    return {
        socketHandler,
        async autoStart(token) {
            if (!token) {
                token = await settings.get("cloudflaredTunnelToken");
            } else {
                await settings.set("cloudflaredTunnelToken", token);
                log.info("cloudflare", "Use cloudflared token from args or env var");
            }
            if (token) {
                log.info("cloudflare", "Start cloudflared");
                const cloudflared = await getCloudflared();
                cloudflared.token = token;
                cloudflared.start();
            }
        },
        async stop() {
            const loaded = loading;
            if (!loaded) {
                return;
            }
            try {
                const cloudflared = await loaded;
                log.info("cloudflared", "Stop cloudflared");
                cloudflared.stop();
            } catch {
                // An optional load failure must not block application shutdown.
            }
        },
    };
}
