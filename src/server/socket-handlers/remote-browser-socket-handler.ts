// @ts-nocheck

/**
 * Handlers for docker hosts
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
import { sendRemoteBrowserList } from "@/server/client";
import { checkLogin } from "@/server/util-server";
import { RemoteBrowser } from "@/server/remote-browser";
import { log } from "@/util";

export const remoteBrowserSocketHandler = (socket, store, io) => {
    socket.on("addRemoteBrowser", async (remoteBrowser, remoteBrowserID, callback) => {
        try {
            checkLogin(socket);

            let remoteBrowserBean = await RemoteBrowser.save(store, remoteBrowser, remoteBrowserID, socket.userID);
            if (remoteBrowserID) {
                const { resetRemoteBrowser } = await import("@/server/monitor-types/real-browser-monitor-type");
                await resetRemoteBrowser(remoteBrowserID, socket.userID);
            }
            await sendRemoteBrowserList(store, io, socket);

            callback({
                ok: true,
                msg: "Saved.",
                msgi18n: true,
                id: remoteBrowserBean.id,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("deleteRemoteBrowser", async (dockerHostID, callback) => {
        try {
            checkLogin(socket);

            await RemoteBrowser.delete(store, dockerHostID, socket.userID);
            const { resetRemoteBrowser } = await import("@/server/monitor-types/real-browser-monitor-type");
            await resetRemoteBrowser(dockerHostID, socket.userID);
            await sendRemoteBrowserList(store, io, socket);

            callback({
                ok: true,
                msg: "successDeleted",
                msgi18n: true,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("testRemoteBrowser", async (remoteBrowser, callback) => {
        try {
            checkLogin(socket);

            const { testRemoteBrowser } = await import("@/server/monitor-types/real-browser-monitor-type");
            let check = await testRemoteBrowser(remoteBrowser.url);
            log.info("remoteBrowser", "Tested remote browser: " + check);
            let msg;

            if (check) {
                msg = "Connected Successfully.";
            }

            callback({
                ok: true,
                msg,
            });
        } catch (e) {
            log.error("remoteBrowser", e);

            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
