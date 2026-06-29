// @ts-nocheck

/**
 * Handlers for database
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
import { checkLogin } from "../util-server.ts";
import Database from "../database.ts";

export const databaseSocketHandler = (socket) => {
    // Post or edit incident
    socket.on("getDatabaseSize", async (callback) => {
        try {
            checkLogin(socket);
            callback({
                ok: true,
                size: await Database.getSize(),
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

    socket.on("shrinkDatabase", async (callback) => {
        try {
            checkLogin(socket);
            await Database.shrink();
            callback({
                ok: true,
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });
};
