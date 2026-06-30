/* eslint-disable camelcase */
/*!
// Shared utilities for frontend and backend
*/

import dayjs from "dayjs";

import { DOWN, SQL_DATETIME_FORMAT, UP } from "@/constants";

/**
 * Flip the status of s between UP and DOWN if this is possible
 * @param s {number} status
 * @returns {number} flipped status
 */
export function flipStatus(s: number) {
    if (s === UP) {
        return DOWN;
    }

    if (s === DOWN) {
        return UP;
    }

    return s;
}

/**
 * Delays for specified number of seconds
 * @param ms Number of milliseconds to sleep for
 * @returns {Promise<void>} Promise that resolves after ms
 */
export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * PHP's ucfirst
 * @param str string input
 * @returns {string} string with first letter capitalized
 */
export function ucfirst(str: string) {
    if (!str) {
        return str;
    }

    const firstLetter = str.substr(0, 1);
    return firstLetter.toUpperCase() + str.substr(1);
}

/**
 * Returns a random number between min (inclusive) and max (exclusive)
 * @param min minumim value, inclusive
 * @param max maximum value, exclusive
 * @returns {number} Random number
 */
export function getRandomArbitrary(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

/**
 * From: https://stackoverflow.com/questions/1527803/generating-random-whole-numbers-in-javascript-in-a-specific-range
 *
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 * @param min minumim value, inclusive
 * @param max maximum value, exclusive
 * @returns {number} Random number
 */
export function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns either the NodeJS crypto.randomBytes() function or its
 * browser equivalent implemented via window.crypto.getRandomValues()
 * @returns {Uint8Array} Random bytes
 */
const getRandomBytes = (
    typeof window !== "undefined" && window.crypto
        ? // Browsers
          function () {
              return (numBytes: number) => {
                  const randomBytes = new Uint8Array(numBytes);
                  for (let i = 0; i < numBytes; i += 65536) {
                      window.crypto.getRandomValues(randomBytes.subarray(i, i + Math.min(numBytes - i, 65536)));
                  }
                  return randomBytes;
              };
          }
        : // Bun backend (Web Crypto API is available without importing node:crypto)
          function () {
              return (numBytes: number) => {
                  const bytes = new Uint8Array(numBytes);
                  crypto.getRandomValues(bytes);
                  return Buffer.from(bytes);
              };
          }
)();

/**
 * Get a random integer suitable for use in cryptography between upper
 * and lower bounds.
 * @param min Minimum value of integer
 * @param max Maximum value of integer
 * @returns Cryptographically suitable random integer
 */
export function getCryptoRandomInt(min: number, max: number): number {
    // synchronous version of: https://github.com/joepie91/node-random-number-csprng

    const range = max - min;
    if (range >= Math.pow(2, 32)) {
        console.log("Warning! Range is too large.");
    }

    let tmpRange = range;
    let bitsNeeded = 0;
    let bytesNeeded = 0;
    let mask = 1;

    while (tmpRange > 0) {
        if (bitsNeeded % 8 === 0) {
            bytesNeeded += 1;
        }
        bitsNeeded += 1;
        mask = (mask << 1) | 1;
        tmpRange = tmpRange >>> 1;
    }

    const randomBytes = getRandomBytes(bytesNeeded);
    let randomValue = 0;

    for (let i = 0; i < bytesNeeded; i++) {
        randomValue |= randomBytes[i] << (8 * i);
    }

    randomValue = randomValue & mask;

    if (randomValue <= range) {
        return min + randomValue;
    } else {
        return getCryptoRandomInt(min, max);
    }
}

/**
 * Generate a random alphanumeric string of fixed length
 * @param length Length of string to generate
 * @returns string
 */
export function genSecret(length = 64) {
    let secret = "";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charsLength = chars.length;
    for (let i = 0; i < length; i++) {
        secret += chars.charAt(getCryptoRandomInt(0, charsLength - 1));
    }
    return secret;
}

/**
 * Get the path of a monitor
 * @param id ID of monitor
 * @returns Formatted relative path
 */
export function getMonitorRelativeURL(id: string) {
    return "/dashboard/" + id;
}

/**
 * Parse to Time Object that used in VueDatePicker
 * @param {string} time E.g. 12:00
 * @returns object
 * @throws {Error} if time string is invalid
 */
export function parseTimeObject(time: string) {
    if (!time) {
        return {
            hours: 0,
            minutes: 0,
        };
    }

    const array = time.split(":");

    if (array.length < 2) {
        throw new Error("parseVueDatePickerTimeFormat: Invalid Time");
    }

    const obj = {
        hours: parseInt(array[0]),
        minutes: parseInt(array[1]),
        seconds: 0,
    };
    if (array.length >= 3) {
        obj.seconds = parseInt(array[2]);
    }
    return obj;
}

/**
 * Parse time to string from object {hours: number, minutes: number, seconds?: number}
 * @param obj object to parse
 * @returns {string} e.g. 12:00
 */
export function parseTimeFromTimeObject(obj: any) {
    if (!obj) {
        return obj;
    }

    let result = "";

    result += obj.hours.toString().padStart(2, "0") + ":" + obj.minutes.toString().padStart(2, "0");

    if (obj.seconds) {
        result += ":" + obj.seconds.toString().padStart(2, "0");
    }

    return result;
}

/**
 * Convert ISO date to UTC
 * @param input Date
 * @returns ISO Date time
 */
export function isoToUTCDateTime(input: string) {
    return dayjs(input).utc().format(SQL_DATETIME_FORMAT);
}

/**
 * @param input valid datetime string
 * @returns {string} ISO DateTime string
 */
export function utcToISODateTime(input: string) {
    return dayjs.utc(input).toISOString();
}

/**
 * For SQL_DATETIME_FORMAT
 * @param input valid datetime string
 * @param format Format to return
 * @returns A string date of SQL_DATETIME_FORMAT
 */
export function utcToLocal(input: string, format = SQL_DATETIME_FORMAT): string {
    return dayjs.utc(input).local().format(format);
}

/**
 * Convert local datetime to UTC
 * @param input Local date
 * @param format Format to return
 * @returns Date in requested format
 */
export function localToUTC(input: string, format = SQL_DATETIME_FORMAT) {
    return dayjs(input).utc().format(format);
}

/**
 * Generate a decimal integer number from a string
 * @param str Input
 * @param length Default is 10 which means 0 - 9
 * @returns {number} output number
 */
export function intHash(str: string, length = 10): number {
    // A simple hashing function (you can use more complex hash functions if needed)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash += str.charCodeAt(i);
    }
    // Normalize the hash to the range [0, 10]
    return ((hash % length) + length) % length; // Ensure the result is non-negative
}