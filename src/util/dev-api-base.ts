// @ts-nocheck

import { getDevContainerServerHostname, isDevContainer } from "@/util-frontend";

let devApiBaseURL;

/**
 * Lazily resolve the development API base URL.
 * @returns {?string} Development API base URL.
 */
function resolveDevApiBaseURL() {
    if (devApiBaseURL !== undefined) {
        return devApiBaseURL;
    }

    const env = process.env.NODE_ENV || "production";
    if (typeof window === "undefined" || typeof location === "undefined") {
        devApiBaseURL = null;
        return devApiBaseURL;
    }

    if (env === "development" && isDevContainer()) {
        devApiBaseURL = location.protocol + "//" + getDevContainerServerHostname();
    } else if (env === "development" || (typeof localStorage !== "undefined" && localStorage.dev === "dev")) {
        devApiBaseURL = location.protocol + "//" + location.hostname + ":3001";
    } else {
        devApiBaseURL = null;
    }

    return devApiBaseURL;
}

/**
 * Resolve a relative API path against the development backend base URL.
 * @param {string} path API path.
 * @returns {string} Fully qualified URL.
 */
function resolveDevApiUrl(path) {
    const baseURL = resolveDevApiBaseURL();
    if (!baseURL) {
        return path;
    }
    return new URL(path, baseURL).toString();
}

/**
 * Get the configured development API base URL.
 * @returns {?string} Development API base URL.
 */
function getDevApiBaseURL() {
    return resolveDevApiBaseURL();
}

/**
 * Fetch a development API endpoint and throw on non-2xx responses.
 * @param {string} path API path.
 * @param {object} options Fetch options.
 * @returns {Promise<Response>} Successful fetch response.
 */
async function fetchDevApi(path, options = {}) {
    const response = await fetch(resolveDevApiUrl(path), options);
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }
    return response;
}

export { resolveDevApiUrl, getDevApiBaseURL, fetchDevApi };
