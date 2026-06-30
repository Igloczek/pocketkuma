// @ts-nocheck

import { badgeConstants } from "@/util";
import chroma from "chroma-js";
import crypto from "node:crypto";
import { exists } from "fs";

/**
 * Get total number of clients in room
 * @param {Server} io Socket server instance
 * @param {string} roomName Name of room to check
 * @returns {number} Total clients in room
 */
export const getTotalClientInRoom = (io, roomName) => {
    const sockets = io.sockets;

    if (!sockets) {
        return 0;
    }

    const adapter = sockets.adapter;

    if (!adapter) {
        return 0;
    }

    const room = adapter.rooms.get(roomName);

    if (room) {
        return room.size;
    } else {
        return 0;
    }
};

/**
 * Returns a color code in hex format based on a given percentage:
 * 0% => hue = 10 => red
 * 100% => hue = 90 => green
 * @param {number} percentage float, 0 to 1
 * @param {number} maxHue Maximum hue - int
 * @param {number} minHue Minimum hue - int
 * @returns {string} Color in hex
 */
export const percentageToColor = (percentage, maxHue = 90, minHue = 10) => {
    const hue = percentage * (maxHue - minHue) + minHue;
    try {
        return chroma(`hsl(${hue}, 90%, 40%)`).hex();
    } catch (err) {
        return badgeConstants.naColor;
    }
};

/**
 * Joins and array of string to one string after filtering out empty values
 * @param {string[]} parts Strings to join
 * @param {string} connector Separator for joined strings
 * @returns {string} Joined strings
 */
export const filterAndJoin = (parts, connector = "") => {
    return parts.filter((part) => !!part && part !== "").join(connector);
};

export const SHAKE256_LENGTH = 16;

/**
 * @param {string} data The data to be hashed
 * @param {number} len Output length of the hash
 * @returns {string} The hashed data in hex format
 */
export const shake256 = (data, len) => {
    if (!data) {
        return "";
    }
    return crypto.createHash("shake256", { outputLength: len }).update(data).digest("hex");
};

/**
 * Non await sleep
 * Source: https://stackoverflow.com/questions/59099454/is-there-a-way-to-call-sleep-without-await-keyword
 * @param {number} n Milliseconds to wait
 * @returns {void}
 */
export const wait = (n) => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
};

/**
 * Async version of fs.existsSync
 * @param {PathLike} path File path
 * @returns {Promise<boolean>} True if file exists, false otherwise
 */
export function fsExists(path) {
    return new Promise(function (resolve, reject) {
        exists(path, function (exists) {
            resolve(exists);
        });
    });
}