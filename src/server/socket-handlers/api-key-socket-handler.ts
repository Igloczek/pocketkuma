// @ts-nocheck

/**
 * Handlers for API keys
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
import { checkLogin } from "@/server/util-server";
import { log } from "@/util";
import { R } from "@/server/redbean-compat";
import { randomId } from "@/util/random-id";
import passwordHash from "@/server/password-hash";
import apicache from "@/server/apicache";
import APIKey from "@/server/model/api_key";
import { Settings } from "@/server/settings";
import { sendAPIKeyList } from "@/server/client";

export const apiKeySocketHandler = (socket) => {
    // Add a new api key
    socket.on("addAPIKey", async (key, callback) => {
        try {
            checkLogin(socket);

            let clearKey = randomId(40);
            let hashedKey = await passwordHash.generate(clearKey);
            key["key"] = hashedKey;
            let bean = await APIKey.save(key, socket.userID);

            log.debug("apikeys", "Added API Key");
            log.debug("apikeys", key);

            // Append key ID and prefix to start of key separated by _, used to get
            // correct hash when validating key.
            let formattedKey = "uk" + bean.id + "_" + clearKey;
            await sendAPIKeyList(socket);

            // Enable API auth if the user creates a key, otherwise only basic
            // auth will be used for API.
            await Settings.set("apiKeysEnabled", true);

            callback({
                ok: true,
                msg: "successAdded",
                msgi18n: true,
                key: formattedKey,
                keyID: bean.id,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("getAPIKeyList", async (callback) => {
        try {
            checkLogin(socket);
            await sendAPIKeyList(socket);
            callback({
                ok: true,
            });
        } catch (e) {
            log.error("apikeys", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("deleteAPIKey", async (keyID, callback) => {
        try {
            checkLogin(socket);

            log.debug("apikeys", `Deleted API Key: ${keyID} User ID: ${socket.userID}`);

            await R.exec("DELETE FROM api_key WHERE id = ? AND user_id = ? ", [keyID, socket.userID]);

            apicache.clear();

            callback({
                ok: true,
                msg: "successDeleted",
                msgi18n: true,
            });

            await sendAPIKeyList(socket);
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("disableAPIKey", async (keyID, callback) => {
        try {
            checkLogin(socket);

            log.debug("apikeys", `Disabled Key: ${keyID} User ID: ${socket.userID}`);

            await R.exec("UPDATE api_key SET active = 0 WHERE id = ? ", [keyID]);

            apicache.clear();

            callback({
                ok: true,
                msg: "successDisabled",
                msgi18n: true,
            });

            await sendAPIKeyList(socket);
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("enableAPIKey", async (keyID, callback) => {
        try {
            checkLogin(socket);

            log.debug("apikeys", `Enabled Key: ${keyID} User ID: ${socket.userID}`);

            await R.exec("UPDATE api_key SET active = 1 WHERE id = ? ", [keyID]);

            apicache.clear();

            callback({
                ok: true,
                msg: "successEnabled",
                msgi18n: true,
            });

            await sendAPIKeyList(socket);
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
