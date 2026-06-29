// @ts-nocheck
"use strict";

const path = require("path");
const { log } = require("../util");
const { setting, printServerUrls } = require("./util-server");
const config = require("./config");
const Database = require("./database");
const StatusPage = require("./model/status_page");
const { Settings } = require("./settings");

const MIME_TYPES = {
    ".br": "application/octet-stream",
    ".css": "text/css; charset=utf-8",
    ".gz": "application/gzip",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webmanifest": "application/manifest+json",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
};

function applyCommonHeaders(headers, disableFrameSameOrigin) {
    if (!disableFrameSameOrigin) {
        headers.set("X-Frame-Options", "SAMEORIGIN");
    }
}

function redirect(location, disableFrameSameOrigin) {
    const headers = new Headers({ Location: location });
    applyCommonHeaders(headers, disableFrameSameOrigin);
    return new Response(null, {
        status: 302,
        headers,
    });
}

function json(data, disableFrameSameOrigin, extraHeaders = {}) {
    const headers = new Headers({
        "Content-Type": "application/json; charset=utf-8",
        ...extraHeaders,
    });
    applyCommonHeaders(headers, disableFrameSameOrigin);
    return new Response(JSON.stringify(data), { headers });
}

function getHostname(request) {
    const url = new URL(request.url);
    const host = request.headers.get("host");
    if (!host) {
        return url.hostname;
    }

    if (host.startsWith("[")) {
        const end = host.indexOf("]");
        return end === -1 ? host : host.slice(1, end);
    }

    return host.split(":")[0];
}

async function resolveTrustedHostname(request) {
    let hostname = getHostname(request);
    const forwardedHost = request.headers.get("x-forwarded-host");
    if ((await Settings.get("trustProxy")) && forwardedHost) {
        hostname = forwardedHost;
    }
    return hostname;
}

function resolveRequestPath(root, requestPath) {
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(requestPath);
    } catch (_) {
        return null;
    }

    if (decodedPath.includes("\0") || path.isAbsolute(decodedPath) || decodedPath.split(/[\\/]+/).includes("..")) {
        return null;
    }

    const resolvedRoot = path.resolve(root);
    const resolvedPath = path.resolve(resolvedRoot, decodedPath);
    if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + path.sep)) {
        return null;
    }

    return resolvedPath;
}

async function serveFile(root, urlPathname, disableFrameSameOrigin) {
    const filePath = resolveRequestPath(root, urlPathname);
    if (!filePath) {
        return null;
    }
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
        return null;
    }

    const headers = new Headers();
    const type = MIME_TYPES[path.extname(filePath)];
    if (type) {
        headers.set("Content-Type", type);
    }
    applyCommonHeaders(headers, disableFrameSameOrigin);
    return new Response(file, { headers });
}

function indexResponse(indexHTML, disableFrameSameOrigin) {
    const headers = new Headers({ "Content-Type": "text/html; charset=utf-8" });
    applyCommonHeaders(headers, disableFrameSameOrigin);
    return new Response(indexHTML, { headers });
}

/**
 * Temporary Bun HTTP adapter for BUN-002.
 *
 * Native Bun routes below cover the default listener, built static assets,
 * setup metadata, entry-page metadata, uploads/screenshots, and SPA fallback.
 * The remaining Express routers are intentionally left in src/server/server.ts as
 * compatibility-only modules until their route handlers are extracted in later
 * migration tasks.
 */
function createBunFetchHandler({ server, disableFrameSameOrigin }) {
    return async function fetch(request, bunServer) {
        const url = new URL(request.url);

        if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
            const upgraded = await server.io.canUpgrade(request, bunServer);
            if (upgraded) {
                return undefined;
            }
            return new Response("WebSocket upgrade rejected.", { status: 403 });
        }

        if (request.method === "GET" && url.pathname === "/") {
            const hostname = await resolveTrustedHostname(request);
            log.debug("entry", `Request Domain: ${hostname}`);

            if (hostname in StatusPage.domainMappingList) {
                return indexResponse(server.indexHTML, disableFrameSameOrigin);
            }

            const uptimeKumaEntryPage = server.entryPage;
            if (uptimeKumaEntryPage && uptimeKumaEntryPage.startsWith("statusPage-")) {
                return redirect("/status/" + uptimeKumaEntryPage.replace("statusPage-", ""), disableFrameSameOrigin);
            }

            return redirect("/dashboard", disableFrameSameOrigin);
        }

        if (request.method === "GET" && url.pathname === "/api/entry-page") {
            const result = {};
            const hostname = await resolveTrustedHostname(request);
            if (hostname in StatusPage.domainMappingList) {
                result.type = "statusPageMatchedDomain";
                result.statusPageSlug = StatusPage.domainMappingList[hostname];
            } else {
                result.type = "entryPage";
                result.entryPage = server.entryPage;
            }

            return json(result, disableFrameSameOrigin);
        }

        if (request.method === "GET" && url.pathname === "/setup-database-info") {
            return json(
                {
                    runningSetup: false,
                    needSetup: false,
                },
                disableFrameSameOrigin
            );
        }

        if (request.method === "GET" && url.pathname === "/robots.txt") {
            let body = "User-agent: *\nDisallow:";
            if (!(await setting("searchEngineIndex"))) {
                body += " /";
            }
            const headers = new Headers({ "Content-Type": "text/plain; charset=utf-8" });
            applyCommonHeaders(headers, disableFrameSameOrigin);
            return new Response(body, { headers });
        }

        if (request.method === "GET" && url.pathname === "/.well-known/change-password") {
            return redirect(
                "https://github.com/louislam/uptime-kuma/wiki/Reset-Password-via-CLI",
                disableFrameSameOrigin
            );
        }

        if (request.method === "GET" && url.pathname.startsWith("/upload/")) {
            const response = await serveFile(
                Database.uploadDir,
                url.pathname.replace(/^\/upload\//, ""),
                disableFrameSameOrigin
            );
            return response || new Response("File not found.", { status: 404 });
        }

        if (request.method === "GET" && url.pathname.startsWith("/screenshots/")) {
            const response = await serveFile(
                Database.screenshotDir,
                url.pathname.replace(/^\/screenshots\//, ""),
                disableFrameSameOrigin
            );
            if (response) {
                return response;
            }
        }

        if (request.method === "GET") {
            const staticPath = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\//, "");
            const staticResponse = await serveFile("dist", staticPath, disableFrameSameOrigin);
            if (staticResponse) {
                return staticResponse;
            }
        }

        return indexResponse(server.indexHTML, disableFrameSameOrigin);
    };
}

function listenWithBunServe({ server, hostname, port, disableFrameSameOrigin }) {
    const bunServer = Bun.serve({
        hostname,
        port,
        fetch: createBunFetchHandler({ server, disableFrameSameOrigin }),
        websocket: {
            open(ws) {
                server.io.open(ws);
            },
            message(ws, message) {
                server.io.message(ws, message);
            },
            close(ws) {
                server.io.close(ws);
            },
        },
        error(error) {
            log.error("server", "Bun.serve request failed: " + error.message);
            return new Response("Internal Server Error", { status: 500 });
        },
    });

    server.bunHttpServer = bunServer;
    printServerUrls("server", port, hostname, config.isSSL);
    return bunServer;
}

module.exports = {
    createBunFetchHandler,
    listenWithBunServe,
    resolveRequestPath,
};
