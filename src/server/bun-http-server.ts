// @ts-nocheck
"use strict";

import fs from "fs";
import path from "path";
import { isDev, log } from "@/util";
import { setting, printServerUrls } from "@/server/util-server";
import config from "@/server/config";
import Database from "@/server/database";
import StatusPage from "@/server/model/status_page";
import { Settings } from "@/server/settings";
import { Prometheus } from "@/server/prometheus";
import { checkAPIAuthRequest } from "@/server/auth";
import { handleApiRequest } from "@/server/routers/api-router";
import { handleStatusPageRequest } from "@/server/routers/status-page-router";
import { applyCommonHeaders, htmlResponse, jsonResponse, redirectResponse, textResponse } from "@/server/bun-response";
import { isCompiledBinary } from "@/server/app-paths";
import { hasEmbeddedAsset, readEmbeddedAsset } from "@/server/generated/embedded-assets";

const MIME_TYPES = {
    ".br": "application/octet-stream",
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".gz": "application/gzip",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".wasm": "application/wasm",
    ".webmanifest": "application/manifest+json",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
};

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
    } catch {
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

function acceptsEncoding(request, encoding) {
    const acceptEncoding = request.headers.get("accept-encoding") || "";
    return acceptEncoding
        .split(",")
        .map((part) => part.trim().toLowerCase())
        .some((part) => part === encoding || part.startsWith(encoding + ";"));
}

async function pickFile(filePath, request, precompressed) {
    if (precompressed && acceptsEncoding(request, "br")) {
        const brotliFile = Bun.file(filePath + ".br");
        if (await brotliFile.exists()) {
            return {
                file: brotliFile,
                contentEncoding: "br",
            };
        }
    }

    if (precompressed && acceptsEncoding(request, "gzip")) {
        const gzipFile = Bun.file(filePath + ".gz");
        if (await gzipFile.exists()) {
            return {
                file: gzipFile,
                contentEncoding: "gzip",
            };
        }
    }

    const file = Bun.file(filePath);
    if (await file.exists()) {
        return { file };
    }

    return null;
}

async function pickEmbeddedFile(webPath, request, precompressed) {
    if (precompressed && acceptsEncoding(request, "br") && hasEmbeddedAsset(`${webPath}.br`)) {
        const file = await readEmbeddedAsset(`${webPath}.br`);
        if (file) {
            return { file, contentEncoding: "br" };
        }
    }

    if (precompressed && acceptsEncoding(request, "gzip") && hasEmbeddedAsset(`${webPath}.gz`)) {
        const file = await readEmbeddedAsset(`${webPath}.gz`);
        if (file) {
            return { file, contentEncoding: "gzip" };
        }
    }

    const file = await readEmbeddedAsset(webPath);
    if (file) {
        return { file };
    }

    return null;
}

async function serveFile(root, urlPathname, request, disableFrameSameOrigin, options = {}) {
    if (isCompiledBinary() && root === "dist") {
        const picked = await pickEmbeddedFile(urlPathname, request, !!options.precompressed);
        if (picked) {
            const headers = new Headers();
            const type = MIME_TYPES[path.extname(urlPathname)];
            if (type) {
                headers.set("Content-Type", type);
            }
            if (picked.contentEncoding) {
                headers.set("Content-Encoding", picked.contentEncoding);
                headers.set("Vary", "Accept-Encoding");
            }
            applyCommonHeaders(headers, disableFrameSameOrigin);
            return new Response(request.method === "HEAD" ? null : picked.file, { headers });
        }

        return null;
    }

    const filePath = resolveRequestPath(root, urlPathname);
    if (!filePath) {
        return null;
    }

    const picked = await pickFile(filePath, request, !!options.precompressed);
    if (!picked) {
        return null;
    }

    const headers = new Headers();
    const type = MIME_TYPES[path.extname(filePath)];
    if (type) {
        headers.set("Content-Type", type);
    }
    if (picked.contentEncoding) {
        headers.set("Content-Encoding", picked.contentEncoding);
        headers.set("Vary", "Accept-Encoding");
    }
    applyCommonHeaders(headers, disableFrameSameOrigin);

    return new Response(request.method === "HEAD" ? null : picked.file, { headers });
}

async function rootResponse(request, server, disableFrameSameOrigin) {
    const hostname = await resolveTrustedHostname(request);
    log.debug("entry", `Request Domain: ${hostname}`);

    if (hostname in StatusPage.domainMappingList) {
        const slug = StatusPage.domainMappingList[hostname];
        const result = await StatusPage.renderHTMLBySlug(server.indexHTML, slug);
        return htmlResponse(result.body, {
            status: result.status,
            disableFrameSameOrigin,
        });
    }

    const uptimeKumaEntryPage = server.entryPage;
    if (uptimeKumaEntryPage && uptimeKumaEntryPage.startsWith("statusPage-")) {
        return redirectResponse("/status/" + uptimeKumaEntryPage.replace("statusPage-", ""), {
            disableFrameSameOrigin,
        });
    }

    return redirectResponse("/dashboard", {
        disableFrameSameOrigin,
    });
}

async function parseDevBody(request) {
    const contentType = request.headers.get("content-type") || "";
    const body = await request.text();

    if (contentType.includes("application/json")) {
        try {
            return JSON.parse(body);
        } catch {
            return body;
        }
    }

    if (contentType.includes("application/x-www-form-urlencoded")) {
        return Object.fromEntries(new URLSearchParams(body).entries());
    }

    return body;
}

async function handleDevRequest(request, disableFrameSameOrigin) {
    if (!isDev) {
        return null;
    }

    const url = new URL(request.url);

    if (
        request.method === "POST" &&
        (url.pathname === "/test-webhook" || url.pathname === "/test-x-www-form-urlencoded")
    ) {
        log.debug("test", Object.fromEntries(request.headers.entries()));
        log.debug("test", await parseDevBody(request));
        return textResponse("OK", { disableFrameSameOrigin });
    }

    if (request.method === "GET" && url.pathname === "/_e2e/take-sqlite-snapshot") {
        await Database.close();
        try {
            fs.cpSync(Database.sqlitePath, `${Database.sqlitePath}.e2e-snapshot`);
        } catch {
            throw new Error("Unable to copy SQLite DB.");
        }
        await Database.connect();

        return textResponse("Snapshot taken.", { disableFrameSameOrigin });
    }

    if (request.method === "GET" && url.pathname === "/_e2e/restore-sqlite-snapshot") {
        if (!fs.existsSync(`${Database.sqlitePath}.e2e-snapshot`)) {
            throw new Error("Snapshot doesn't exist.");
        }

        await Database.close();
        try {
            fs.cpSync(`${Database.sqlitePath}.e2e-snapshot`, Database.sqlitePath);
        } catch {
            throw new Error("Unable to copy snapshot file.");
        }
        await Database.connect();

        return textResponse("Snapshot restored.", { disableFrameSameOrigin });
    }

    return null;
}

async function metricsResponse(request, disableFrameSameOrigin) {
    const authResponse = await checkAPIAuthRequest(request, { disableFrameSameOrigin });
    if (authResponse) {
        return authResponse;
    }

    const metrics = await Prometheus.metrics();
    return textResponse(metrics.body, {
        type: metrics.contentType,
        disableFrameSameOrigin,
    });
}

function createBunFetchHandler({ server, disableFrameSameOrigin }) {
    return async function fetch(request, bunServer) {
        const url = new URL(request.url);

        if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
            const upgraded = await server.io.canUpgrade(request, bunServer);
            if (upgraded) {
                return undefined;
            }
            return textResponse("WebSocket upgrade rejected.", {
                status: 403,
                disableFrameSameOrigin,
            });
        }

        if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/") {
            return rootResponse(request, server, disableFrameSameOrigin);
        }

        const devResponse = await handleDevRequest(request, disableFrameSameOrigin);
        if (devResponse) {
            return devResponse;
        }

        if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/robots.txt") {
            let body = "User-agent: *\nDisallow:";
            if (!(await setting("searchEngineIndex"))) {
                body += " /";
            }
            return textResponse(body, { disableFrameSameOrigin });
        }

        if (
            (request.method === "GET" || request.method === "HEAD") &&
            url.pathname === "/.well-known/change-password"
        ) {
            return redirectResponse("https://github.com/louislam/uptime-kuma/wiki/Reset-Password-via-CLI", {
                disableFrameSameOrigin,
            });
        }

        if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/metrics") {
            return metricsResponse(request, disableFrameSameOrigin);
        }

        const apiResponse = await handleApiRequest(request, { server, disableFrameSameOrigin });
        if (apiResponse) {
            return apiResponse;
        }

        const statusPageResponse = await handleStatusPageRequest(request, { server, disableFrameSameOrigin });
        if (statusPageResponse) {
            return statusPageResponse;
        }

        if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/upload/")) {
            const response = await serveFile(
                Database.uploadDir,
                url.pathname.replace(/^\/upload\//, ""),
                request,
                disableFrameSameOrigin
            );
            return response || textResponse("File not found.", { status: 404, disableFrameSameOrigin });
        }

        if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/screenshots/")) {
            const response = await serveFile(
                Database.screenshotDir,
                url.pathname.replace(/^\/screenshots\//, ""),
                request,
                disableFrameSameOrigin
            );
            if (response) {
                return response;
            }
        }

        if (request.method === "GET" || request.method === "HEAD") {
            const staticPath = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\//, "");
            const staticResponse = await serveFile("dist", staticPath, request, disableFrameSameOrigin, {
                precompressed: true,
            });
            if (staticResponse) {
                return staticResponse;
            }
        }

        return htmlResponse(server.indexHTML, { disableFrameSameOrigin });
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

export { createBunFetchHandler, listenWithBunServe, resolveRequestPath };
