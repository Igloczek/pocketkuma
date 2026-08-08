// @ts-nocheck

import { exists } from "fs";

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
