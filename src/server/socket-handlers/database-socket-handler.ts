// @ts-nocheck

/**
 * Handlers for database
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
import { checkLogin } from "@/server/socket-auth";
import Database from "@/server/database";
import type { SQLiteStore } from "@/server/db-migrations";

export const databaseSocketHandler = (socket, store: SQLiteStore) => {
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
            await Database.shrink(store);
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
