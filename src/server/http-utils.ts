// @ts-nocheck

import { log } from "@/util";

/**
 * Check if the provided status code is within the accepted ranges
 * @param {number} status The status code to check
 * @param {string[]} acceptedCodes An array of accepted status codes
 * @returns {boolean} True if status code within range, false otherwise
 */
export function checkStatusCode(status, acceptedCodes) {
    if (acceptedCodes == null || acceptedCodes.length === 0) {
        return false;
    }

    for (const codeRange of acceptedCodes) {
        if (typeof codeRange !== "string") {
            log.error("monitor", `Accepted status code not a string. ${codeRange} is of type ${typeof codeRange}`);
            continue;
        }

        const codeRangeSplit = codeRange.split("-").map((string) => parseInt(string));
        if (codeRangeSplit.length === 1) {
            if (status === codeRangeSplit[0]) {
                return true;
            }
        } else if (codeRangeSplit.length === 2) {
            if (status >= codeRangeSplit[0] && status <= codeRangeSplit[1]) {
                return true;
            }
        } else {
            log.error("monitor", `${codeRange} is not a valid status code range`);
            continue;
        }
    }

    return false;
}

/**
 * Allow CORS all origins if development
 * @param {object} res Response object from axios
 * @returns {void}
 */
export const allowDevAllOrigin = (res) => {
    if (process.env.NODE_ENV === "development") {
        allowAllOrigin(res);
    }
};

/**
 * Allow CORS all origins
 * @param {object} res Response object from axios
 * @returns {void}
 */
export const allowAllOrigin = (res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
};

/**
 * Send an Error response
 * @param {object} res HTTP response object
 * @param {string} msg Message to send
 * @returns {void}
 */
export const sendHttpError = (res, msg = "") => {
    if (msg.includes("SQLITE_BUSY") || msg.includes("SQLITE_LOCKED")) {
        res.status(503).json({
            status: "fail",
            msg: msg,
        });
    } else if (msg.toLowerCase().includes("not found")) {
        res.status(404).json({
            status: "fail",
            msg: msg,
        });
    } else {
        res.status(403).json({
            status: "fail",
            msg: msg,
        });
    }
};

/**
 * Encode user and password to Base64 encoding
 * for HTTP "basic" auth, as per RFC-7617
 * @param {string|null} user - The username (defaults to empty string if null/undefined)
 * @param {string|null} pass - The password (defaults to empty string if null/undefined)
 * @returns {string} Encoded Base64 string
 */
export function encodeBase64(user, pass) {
    return Buffer.from(`${user || ""}:${pass || ""}`).toString("base64");
}

/**
 * Generates an abort signal with the specified timeout.
 * @param {number} timeoutMs - The timeout in milliseconds.
 * @returns {AbortSignal | null} - The generated abort signal, or null if not supported.
 */
export const axiosAbortSignal = (timeoutMs) => {
    try {
        // Just in case, as 0 timeout here will cause the request to be aborted immediately
        if (!timeoutMs || timeoutMs <= 0) {
            timeoutMs = 5000;
        }
        return AbortSignal.timeout(timeoutMs);
    } catch (_) {
        // v16-: AbortSignal.timeout is not supported
        try {
            const abortController = new AbortController();
            setTimeout(() => abortController.abort(), timeoutMs);

            return abortController.signal;
        } catch (_) {
            // v15-: AbortController is not supported
            return null;
        }
    }
};