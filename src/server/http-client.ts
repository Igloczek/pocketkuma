// @ts-nocheck

const defaultOptions = { timeout: 300_000, headers: {} };

function setDefaults(options = {}) {
    if (options.timeout !== undefined) {
        defaultOptions.timeout = options.timeout;
    }
    if (options.headers) {
        defaultOptions.headers = { ...defaultOptions.headers, ...options.headers };
    }
}

class HttpClientError extends Error {
    constructor(message, response = null, code = null) {
        super(message);
        this.name = "HttpClientError";
        this.response = response;
        this.code = code;
    }
}

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

function resolveRequestUrl(options) {
    let url = options.url ?? "";

    if (options.baseURL && url && !/^https?:\/\//.test(url)) {
        url = new URL(url, options.baseURL).toString();
    } else if (options.baseURL && !url) {
        url = options.baseURL;
    }

    return appendParams(url, options.params);
}

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
    if (!contentType || contentType.includes("application/json")) {
        if (!contentType) {
            headers.set("Content-Type", "application/json");
        }
        return JSON.stringify(body);
    }

    return body;
}

async function readResponse(response) {
    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json") && text.length > 0) {
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    return text;
}

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

const UNSUPPORTED_OPTIONS = ["httpAgent", "httpsAgent", "transport", "agent"];

function assertSupportedOptions(options) {
    for (const option of UNSUPPORTED_OPTIONS) {
        if (options[option] !== undefined) {
            throw new HttpClientError(
                `Unsupported fetch HTTP client option: ${option}`,
                null,
                "ERR_UNSUPPORTED_HTTP_OPTION"
            );
        }
    }
}

function buildFetchTransportOptions(options) {
    const fetchOptions = {};

    if (options.socketPath) {
        fetchOptions.unix = options.socketPath;
    }
    if (options.proxy) {
        fetchOptions.proxy = options.proxy;
    }
    const tls = { ...(options.tls || {}) };
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

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DROP_BODY_ON_REDIRECT = new Set([301, 302, 303]);

async function fetchWithRedirects(url, init, maxRedirects) {
    let { method, headers, body, signal, ...transport } = init;

    for (let redirects = 0; redirects <= maxRedirects; redirects++) {
        const response = await fetch(url, {
            method,
            headers,
            body: method === "GET" || method === "HEAD" ? undefined : body,
            signal,
            redirect: "manual",
            ...transport,
        });

        if (!REDIRECT_STATUSES.has(response.status)) {
            return response;
        }

        const location = response.headers.get("location");
        if (!location || redirects === maxRedirects) {
            throw new HttpClientError("max redirects exceeded", null, "ERR_FR_TOO_MANY_REDIRECTS");
        }

        if (DROP_BODY_ON_REDIRECT.has(response.status) && method !== "GET" && method !== "HEAD") {
            method = "GET";
            body = undefined;
            for (const header of ["Content-Type", "content-type", "Content-Length", "content-length"]) {
                headers.delete(header);
            }
        }

        url = new URL(location, url).toString();
    }
}

async function request(options) {
    assertSupportedOptions(options);

    const method = (options.method || "GET").toUpperCase();
    const headers = new Headers({ ...defaultOptions.headers, ...(options.headers || {}) });
    const url = resolveRequestUrl(options);
    const body = normalizeBody(options.data ?? options.body, headers);
    const timeout = options.timeout ?? defaultOptions.timeout;
    const signal = options.signal || timeoutSignal(timeout);
    const transport = buildFetchTransportOptions(options);
    const requestBody = method === "GET" || method === "HEAD" ? undefined : body;

    let response;
    try {
        if (Number.isInteger(options.maxRedirects)) {
            response = await fetchWithRedirects(
                url,
                { method, headers, body, signal, ...transport },
                options.maxRedirects
            );
        } else {
            response = await fetch(url, {
                method,
                headers,
                body: requestBody,
                signal,
                redirect: "follow",
                ...transport,
            });
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

const verb = (method) => (url, data, options = {}) =>
    request({ ...options, url, ...(data !== undefined ? { data } : {}), method });

const get = (url, options = {}) => request({ ...options, url, method: "GET" });
const post = verb("POST");
const put = verb("PUT");

function isCancel(error) {
    return (
        error?.name === "AbortError" ||
        (error instanceof HttpClientError && error.code === "ECONNABORTED") ||
        error?.code === "ECONNABORTED"
    );
}

export { HttpClientError, request, get, post, put, isCancel, setDefaults };
export default { request, get, post, put, isCancel, HttpClientError, setDefaults };