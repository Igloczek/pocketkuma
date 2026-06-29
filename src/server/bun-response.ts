// @ts-nocheck
"use strict";

const CACHE_UNITS = {
    second: 1000,
    seconds: 1000,
    minute: 60 * 1000,
    minutes: 60 * 1000,
    hour: 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
};

const responseCache = new Map();

function applyCommonHeaders(headers, disableFrameSameOrigin) {
    if (!disableFrameSameOrigin) {
        headers.set("X-Frame-Options", "SAMEORIGIN");
    }
}

function applyCorsHeaders(headers) {
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
}

function createHeaders({ type, headers, disableFrameSameOrigin, cors, devCors } = {}) {
    const result = new Headers(headers || {});
    if (type) {
        result.set("Content-Type", type);
    }
    if (cors || (devCors && process.env.NODE_ENV === "development")) {
        applyCorsHeaders(result);
    }
    applyCommonHeaders(result, disableFrameSameOrigin);
    return result;
}

function bodyResponse(body, options = {}) {
    return new Response(body, {
        status: options.status || 200,
        headers: createHeaders(options),
    });
}

function jsonResponse(data, options = {}) {
    return bodyResponse(JSON.stringify(data), {
        ...options,
        type: "application/json; charset=utf-8",
    });
}

function textResponse(body, options = {}) {
    return bodyResponse(body, {
        ...options,
        type: options.type || "text/plain; charset=utf-8",
    });
}

function htmlResponse(body, options = {}) {
    return bodyResponse(body, {
        ...options,
        type: "text/html; charset=utf-8",
    });
}

function redirectResponse(location, options = {}) {
    return new Response(null, {
        status: options.status || 302,
        headers: createHeaders({
            ...options,
            headers: {
                ...(options.headers || {}),
                Location: location,
            },
        }),
    });
}

function httpErrorResponse(msg = "", options = {}) {
    let status;
    if (msg.includes("SQLITE_BUSY") || msg.includes("SQLITE_LOCKED")) {
        status = 503;
    } else if (msg.toLowerCase().includes("not found")) {
        status = 404;
    } else {
        status = 403;
    }

    return jsonResponse(
        {
            status: "fail",
            msg,
        },
        {
            ...options,
            status,
        }
    );
}

function parseDuration(value) {
    if (typeof value === "number") {
        return value;
    }

    const match = String(value)
        .trim()
        .match(/^(\d+)\s+([a-z]+)$/i);
    if (!match) {
        return 0;
    }

    return Number(match[1]) * (CACHE_UNITS[match[2].toLowerCase()] || 0);
}

async function cachedResponse(cacheKey, duration, factory) {
    const ttl = parseDuration(duration);
    if (!ttl) {
        return factory();
    }

    const now = Date.now();
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expires > now) {
        return new Response(cached.body, {
            status: cached.status,
            headers: cached.headers,
        });
    }

    const response = await factory();
    const body = await response.text();
    const snapshot = {
        body,
        status: response.status,
        headers: Array.from(response.headers.entries()),
        expires: now + ttl,
    };
    responseCache.set(cacheKey, snapshot);

    return new Response(body, {
        status: snapshot.status,
        headers: snapshot.headers,
    });
}

function clearResponseCache() {
    responseCache.clear();
}

function queryObject(searchParams) {
    const query = {};
    for (const [key, value] of searchParams.entries()) {
        query[key] = value;
    }
    return query;
}

function decodePathParam(value) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export {
    applyCommonHeaders,
    applyCorsHeaders,
    bodyResponse,
    cachedResponse,
    clearResponseCache,
    createHeaders,
    decodePathParam,
    htmlResponse,
    httpErrorResponse,
    jsonResponse,
    queryObject,
    redirectResponse,
    textResponse,
};
