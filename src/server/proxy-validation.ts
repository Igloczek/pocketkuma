// @ts-nocheck

import { isIP } from "node:net";

const SUPPORTED_PROXY_PROTOCOLS = ["http", "https", "socks", "socks5", "socks5h", "socks4"];
const CORE_HTTP_MONITOR_TYPES = new Set(["http", "keyword", "json-query"]);

function normalizeProxyHost(value) {
    if (typeof value !== "string" || !value || value !== value.trim() || /\s/.test(value)) {
        throw new Error("Invalid proxy host");
    }

    if (value.startsWith("[") || value.endsWith("]")) {
        if (!(value.startsWith("[") && value.endsWith("]")) || isIP(value.slice(1, -1)) !== 6) {
            throw new Error("Invalid proxy host");
        }
        return value.slice(1, -1);
    }

    if (isIP(value)) {
        return value;
    }

    let parsed;
    try {
        parsed = new URL(`http://${value}`);
    } catch {
        throw new Error("Invalid proxy host");
    }
    if (
        parsed.username ||
        parsed.password ||
        parsed.port ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash ||
        parsed.hostname !== value
    ) {
        throw new Error("Invalid proxy host");
    }

    const dnsName = value.endsWith(".") ? value.slice(0, -1) : value;
    if (
        dnsName.length > 253 ||
        /^[\d.]+$/.test(dnsName) ||
        !dnsName.split(".").every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))
    ) {
        throw new Error("Invalid proxy host");
    }
    return value;
}

function validateProxyDefinition(proxy) {
    if (!proxy || !SUPPORTED_PROXY_PROTOCOLS.includes(proxy.protocol)) {
        throw new Error(
            `Unsupported proxy protocol "${proxy?.protocol}". Supported protocols are ${SUPPORTED_PROXY_PROTOCOLS.join(", ")}.`
        );
    }
    if (typeof proxy.port !== "number" || !Number.isInteger(proxy.port) || proxy.port < 1 || proxy.port > 65535) {
        throw new Error("Proxy port must be an integer between 1 and 65535");
    }

    const auth = proxy.auth === true || proxy.auth === 1;
    if (
        auth &&
        (typeof proxy.username !== "string" || !proxy.username || typeof proxy.password !== "string" || !proxy.password)
    ) {
        throw new Error("Proxy username and password are required when authentication is enabled");
    }

    return {
        protocol: proxy.protocol,
        host: normalizeProxyHost(proxy.host),
        port: proxy.port,
        auth,
        username: auth ? proxy.username : null,
        password: auth ? proxy.password : null,
        active: !(proxy.active === false || proxy.active === 0),
        default: proxy.default === true || proxy.default === 1,
    };
}

async function resolveCoreHttpProxy(store, type, proxyID, userID, ignoreTls) {
    if (!CORE_HTTP_MONITOR_TYPES.has(type) || proxyID === null || proxyID === undefined) {
        return null;
    }
    if (!Number.isInteger(proxyID) || proxyID < 1) {
        throw new Error("Assigned proxy is unavailable for this monitor");
    }

    const proxy = await store.findOne("proxy", " id = ? AND user_id = ? ", [proxyID, userID]);
    if (!proxy) {
        throw new Error("Assigned proxy is unavailable for this monitor");
    }

    const validated = validateProxyDefinition(proxy);
    if (!validated.active) {
        throw new Error("Assigned proxy is inactive");
    }
    if (!["http", "https"].includes(validated.protocol)) {
        throw new Error(`SOCKS proxy protocol "${validated.protocol}" is not supported by the Bun fetch HTTP client`);
    }
    if (ignoreTls && validated.protocol === "https") {
        throw new Error("Ignore TLS with an HTTPS proxy is not supported by the Bun fetch HTTP client");
    }
    return validated;
}

function buildProxyFetchOption(proxy) {
    const proxyUrl = new URL(`${proxy.protocol}://localhost`);
    proxyUrl.hostname = isIP(proxy.host) === 6 ? `[${proxy.host}]` : proxy.host;
    proxyUrl.port = String(proxy.port);
    if (!proxy.auth) {
        return proxyUrl.toString();
    }
    return {
        url: proxyUrl.toString(),
        headers: {
            "Proxy-Authorization": `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString("base64")}`,
        },
    };
}

export { SUPPORTED_PROXY_PROTOCOLS, buildProxyFetchOption, resolveCoreHttpProxy, validateProxyDefinition };
