// @ts-nocheck

/**
 * Handlers for docker hosts
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
import { sendRemoteBrowserList } from "../client.ts";
import { checkLogin } from "../util-server.ts";
import { RemoteBrowser } from "../remote-browser.ts";
import { log } from "../../util.ts";
import { testRemoteBrowser } from "../monitor-types/real-browser-monitor-type.ts";

export const remoteBrowserSocketHandler = (socket) => {
    socket.on("addRemoteBrowser", async (remoteBrowser, remoteBrowserID, callback) => {
        try {
            checkLogin(socket);

            let remoteBrowserBean = await RemoteBrowser.save(remoteBrowser, remoteBrowserID, socket.userID);
            await sendRemoteBrowserList(socket);

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

            await RemoteBrowser.delete(dockerHostID, socket.userID);
            await sendRemoteBrowserList(socket);

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
