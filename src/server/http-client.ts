// @ts-nocheck
class HttpClientError extends Error {
    /**
     * Create an HTTP client error.
     * @param {string} message Error message.
     * @param {?object} response HTTP response, if one was received.
     * @param {?string} code Stable error code.
     */
    constructor(message, response = null, code = null) {
        super(message);
        this.name = "HttpClientError";
        this.response = response;
        this.code = code;
    }
}

/**
 * Append query parameters to a URL.
 * @param {string} url Request URL.
 * @param {?object} params Query parameters.
 * @returns {string} URL with query parameters.
 */
function appendParams(url, params) {
    if (!params) {
        return url;
    }

    const parsed = new URL(url);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            parsed.searchParams.set(key, value);
        }
    }
    return parsed.toString();
}

/**
 * Convert request body data into a fetch-compatible body.
 * @param {unknown} body Request body.
 * @param {Headers} headers Request headers.
 * @returns {unknown} Fetch-compatible body.
 */
function normalizeBody(body, headers) {
    if (body === undefined || body === null || typeof body === "string" || body instanceof URLSearchParams) {
        return body;
    }

    const contentType = headers.get("Content-Type") || headers.get("content-type") || "";
    if (!contentType) {
        headers.set("Content-Type", "application/json");
        return JSON.stringify(body);
    }

    if (contentType.includes("application/json")) {
        return JSON.stringify(body);
    }

    return body;
}

/**
 * Read a fetch response into the shape expected by monitors.
 * @param {Response} response Fetch response.
 * @returns {Promise<unknown>} Parsed response payload.
 */
async function readResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    if (contentType.includes("application/json") && text.length > 0) {
        try {
            return JSON.parse(text);
        } catch (_) {
            return text;
        }
    }

    return text;
}

/**
 * Create an abort signal for a request timeout.
 * @param {number} timeout Timeout in milliseconds.
 * @returns {?AbortSignal} Abort signal.
 */
function timeoutSignal(timeout) {
    if (!timeout || timeout <= 0) {
        return null;
    }

    if (AbortSignal.timeout) {
        return AbortSignal.timeout(timeout);
    }

    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);
    return controller.signal;
}

/**
 * Reject unsupported Axios transport options before fetch can silently ignore them.
 * @param {object} options Request options.
 * @returns {void}
 * @throws {HttpClientError} Unsupported transport option.
 */
function assertSupportedOptions(options) {
    const unsupportedOptions = [
        "httpAgent",
        "httpsAgent",
        "proxy",
        "socketPath",
        "transport",
        "agent",
        "cert",
        "key",
        "ca",
        "rejectUnauthorized",
    ];

    for (const option of unsupportedOptions) {
        if (options[option] !== undefined) {
            throw new HttpClientError(
                `Unsupported fetch HTTP client option: ${option}`,
                null,
                "ERR_UNSUPPORTED_HTTP_OPTION"
            );
        }
    }
}

/**
 * Send an HTTP request through native fetch.
 * @param {object} options Request options.
 * @returns {Promise<object>} Axios-like response object.
 */
async function request(options) {
    assertSupportedOptions(options);

    const method = (options.method || "GET").toUpperCase();
    const headers = new Headers(options.headers || {});
    let url = appendParams(options.url || options.baseURL + options.url, options.params);
    const body = normalizeBody(options.data ?? options.body, headers);
    const signal = options.signal || timeoutSignal(options.timeout);
    const maxRedirects = Number.isInteger(options.maxRedirects) ? options.maxRedirects : 20;

    let response;
    try {
        for (let redirects = 0; redirects <= maxRedirects; redirects++) {
            response = await fetch(url, {
                method,
                headers,
                body,
                signal,
                redirect: "manual",
            });

            if (![301, 302, 303, 307, 308].includes(response.status)) {
                break;
            }

            const location = response.headers.get("location");
            if (!location) {
                break;
            }

            if (redirects === maxRedirects) {
                throw new HttpClientError("max redirects exceeded", null, "ERR_FR_TOO_MANY_REDIRECTS");
            }

            url = new URL(location, url).toString();
        }
    } catch (error) {
        if (error instanceof HttpClientError) {
            throw error;
        }
        if (error.name === "AbortError" || error.name === "TimeoutError") {
            throw new HttpClientError(`timeout of ${options.timeout}ms exceeded`, null, "ECONNABORTED");
        }
        throw error;
    }

    const data = await readResponse(response);
    const result = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        url: response.url,
        request: null,
    };

    const validateStatus = options.validateStatus || ((status) => status >= 200 && status < 300);
    if (!validateStatus(response.status)) {
        throw new HttpClientError(`Request failed with status code ${response.status}`, result);
    }

    return result;
}

/**
 * Send a GET request.
 * @param {string} url Request URL.
 * @param {object} options Request options.
 * @returns {Promise<object>} Axios-like response object.
 */
async function get(url, options = {}) {
    return request({ ...options, url, method: "GET" });
}

/**
 * Send a POST request.
 * @param {string} url Request URL.
 * @param {unknown} data Request body.
 * @param {object} options Request options.
 * @returns {Promise<object>} Axios-like response object.
 */
async function post(url, data, options = {}) {
    return request({ ...options, url, data, method: "POST" });
}

module.exports = {
    HttpClientError,
    request,
    get,
    post,
};
