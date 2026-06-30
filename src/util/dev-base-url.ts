// @ts-nocheck

let cachedDevBaseURL;

/**
 * Are we currently running in a dev container?
 * @returns {boolean} Running in dev container?
 */
export function isDevContainer() {
    // eslint-disable-next-line no-undef
    return typeof DEVCONTAINER === "string" && DEVCONTAINER === "1";
}

/**
 * Supports GitHub Codespaces only currently
 * @returns {string} Dev container server hostname
 */
export function getDevContainerServerHostname() {
    if (!isDevContainer()) {
        return "";
    }

    // eslint-disable-next-line no-undef
    return CODESPACE_NAME + "-3001." + GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
}

/**
 * Resolve the development backend base URL for API calls and static assets.
 * Mainly used for dev, because the backend and the frontend are on different ports.
 * @returns {string} Base URL, or empty string when the current origin should be used.
 */
export function getDevBaseURL() {
    if (cachedDevBaseURL !== undefined) {
        return cachedDevBaseURL;
    }

    const env = process.env.NODE_ENV || "production";
    if (typeof window === "undefined" || typeof location === "undefined") {
        cachedDevBaseURL = "";
        return cachedDevBaseURL;
    }

    if (env === "development" && isDevContainer()) {
        cachedDevBaseURL = location.protocol + "//" + getDevContainerServerHostname();
    } else if (env === "development" || (typeof localStorage !== "undefined" && localStorage.dev === "dev")) {
        cachedDevBaseURL = location.protocol + "//" + location.hostname + ":3001";
    } else {
        cachedDevBaseURL = "";
    }

    return cachedDevBaseURL;
}

/**
 * Resolve a relative API path against the development backend base URL.
 * @param {string} path API path.
 * @returns {string} Fully qualified URL.
 */
export function resolveDevApiUrl(path) {
    const baseURL = getDevBaseURL();
    if (!baseURL) {
        return path;
    }
    return new URL(path, baseURL).toString();
}

/**
 * Fetch a development API endpoint and throw on non-2xx responses.
 * @param {string} path API path.
 * @param {object} options Fetch options.
 * @returns {Promise<Response>} Successful fetch response.
 */
export async function fetchDevApi(path, options = {}) {
    const response = await fetch(resolveDevApiUrl(path), options);
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }
    return response;
}