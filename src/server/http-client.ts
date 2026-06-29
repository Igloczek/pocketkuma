// @ts-nocheck

const defaultOptions = {
    timeout: 300_000,
    headers: {},
};

/**
 * Configure default HTTP client options.
 * @param {object} options Default options.
 * @returns {void}
 */
function setDefaults(options = {}) {
    if (options.timeout !== undefined) {
        defaultOptions.timeout = options.timeout;
    }
    if (options.headers) {
        defaultOptions.headers = { ...defaultOptions.headers, ...options.headers };
    }
}

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
    if (
        body === undefined ||
        body === null ||
        typeof body === "string" ||
        body instanceof URLSearchParams ||
        body instanceof FormData
    ) {
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
    const unsupportedOptions = ["httpAgent", "httpsAgent", "transport", "agent"];

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
 * Build Bun fetch transport options from axios-like config.
 * @param {object} options Request options.
 * @returns {object} Fetch transport options.
 */
function buildFetchTransportOptions(options) {
    const fetchOptions = {};

    if (options.socketPath) {
        fetchOptions.unix = options.socketPath;
    }

    if (options.proxy) {
        fetchOptions.proxy = options.proxy;
    }

    const tls = options.tls || {};
    if (options.cert) {
        tls.cert = options.cert;
    }
    if (options.key) {
        tls.key = options.key;
    }
    if (options.ca) {
        tls.ca = options.ca;
    }
    if (options.rejectUnauthorized !== undefined) {
        tls.rejectUnauthorized = options.rejectUnauthorized;
    }

    if (Object.keys(tls).length > 0) {
        fetchOptions.tls = tls;
    }

    return fetchOptions;
}

/**
 * Resolve the request URL from axios-like options.
 * @param {object} options Request options.
 * @returns {string} Request URL.
 */
function resolveRequestUrl(options) {
    if (options.url && (options.url.startsWith("http://") || options.url.startsWith("https://"))) {
        return appendParams(options.url, options.params);
    }

    if (options.baseURL && options.url) {
        return appendParams(new URL(options.url, options.baseURL).toString(), options.params);
    }

    if (options.url) {
        return appendParams(options.url, options.params);
    }

    if (options.baseURL) {
        return appendParams(options.baseURL, options.params);
    }

    return appendParams("", options.params);
}

/**
 * Send an HTTP request through native fetch.
 * @param {object} options Request options.
 * @returns {Promise<object>} Axios-like response object.
 */
async function request(options) {
    assertSupportedOptions(options);

    let method = (options.method || "GET").toUpperCase();
    const headers = new Headers({ ...defaultOptions.headers, ...(options.headers || {}) });
    let url = resolveRequestUrl(options);
    let body = normalizeBody(options.data ?? options.body, headers);
    const timeout = options.timeout ?? defaultOptions.timeout;
    const signal = options.signal || timeoutSignal(timeout);
    const maxRedirects = Number.isInteger(options.maxRedirects) ? options.maxRedirects : 20;
    const fetchTransportOptions = buildFetchTransportOptions(options);

    let response;
    try {
        for (let redirects = 0; redirects <= maxRedirects; redirects++) {
            response = await fetch(url, {
                method,
                headers,
                body: method === "GET" || method === "HEAD" ? undefined : body,
                signal,
                redirect: "manual",
                ...fetchTransportOptions,
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

            if ([301, 302, 303].includes(response.status) && method !== "GET" && method !== "HEAD") {
                method = "GET";
                body = undefined;
                headers.delete("Content-Type");
                headers.delete("content-type");
                headers.delete("Content-Length");
                headers.delete("content-length");
            }

            url = new URL(location, url).toString();
        }
    } catch (error) {
        if (error instanceof HttpClientError) {
            throw error;
        }
        if (error.name === "AbortError" || error.name === "TimeoutError") {
            throw new HttpClientError(`timeout of ${timeout}ms exceeded`, null, "ECONNABORTED");
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

/**
 * Send a PUT request.
 * @param {string} url Request URL.
 * @param {unknown} data Request body.
 * @param {object} options Request options.
 * @returns {Promise<object>} Axios-like response object.
 */
async function put(url, data, options = {}) {
    return request({ ...options, url, data, method: "PUT" });
}

/**
 * Check whether an error was caused by an aborted request.
 * @param {unknown} error Error to inspect.
 * @returns {boolean} True when the request was aborted.
 */
function isCancel(error) {
    return (
        error?.name === "AbortError" ||
        (error instanceof HttpClientError && error.code === "ECONNABORTED") ||
        error?.code === "ECONNABORTED"
    );
}

export { HttpClientError, request, get, post, put, isCancel, setDefaults };

export default { request, get, post, put, isCancel, HttpClientError, setDefaults };
