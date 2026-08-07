// @ts-nocheck

import { checkLogin } from "@/server/util-server";
import { doubleCheckPassword } from "@/server/server-auth-helpers";
import { CloudflaredTunnel } from "node-cloudflared-tunnel";
import { log } from "@/util";

const prefix = "cloudflared_";

export function createCloudflaredRuntime(io, settings) {
    const cloudflared = new CloudflaredTunnel();

    cloudflared.change = (running, message) => {
        io.to("cloudflared").emit(prefix + "running", running);
        io.to("cloudflared").emit(prefix + "message", message);
    };
    cloudflared.error = (errorMessage) => io.to("cloudflared").emit(prefix + "errorMessage", errorMessage);

    const socketHandler = (socket, store) => {
        socket.on(prefix + "join", async () => {
            try {
                checkLogin(socket);
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
                if (token && typeof token === "string") {
                    await settings.set("cloudflaredTunnelToken", token);
                    cloudflared.token = token;
                } else {
                    cloudflared.token = null;
                }
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
                cloudflared.token = token;
                cloudflared.start();
            }
        },
        stop() {
            log.info("cloudflared", "Stop cloudflared");
            cloudflared.stop();
        },
    };
}
