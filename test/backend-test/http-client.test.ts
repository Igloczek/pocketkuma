// @ts-nocheck

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import httpClient from "@/server/http-client";
import { R } from "@/server/bun-sqlite-store";

describe("fetch HTTP client", () => {
    let server;
    let baseUrl;
    let proxyServer;
    let proxyUrl;
    let tlsServer;
    let tlsUrl;
    const proxyRequests = [];

    beforeAll(async () => {
        server = http.createServer((req, res) => {
            if (req.url === "/ok") {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true }));
                return;
            }

            if (req.url === "/keyword") {
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("service contains expected-keyword");
                return;
            }

            if (req.url === "/slow") {
                setTimeout(() => {
                    res.writeHead(200, { "Content-Type": "text/plain" });
                    res.end("late");
                }, 200);
                return;
            }

            if (req.url === "/redirect") {
                res.writeHead(302, { Location: "/ok" });
                res.end();
                return;
            }

            if (req.url === "/post-redirect" && req.method === "POST") {
                res.writeHead(303, { Location: "/post-target" });
                res.end();
                return;
            }

            if (req.url === "/post-target" && req.method === "GET") {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ method: "GET" }));
                return;
            }

            if (req.url === "/error") {
                res.writeHead(503, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "unavailable" }));
                return;
            }

            if (req.url === "/teapot") {
                res.writeHead(418, { "Content-Type": "text/plain" });
                res.end("teapot");
                return;
            }

            if (req.url === "/echo") {
                const chunks = [];
                req.on("data", (chunk) => chunks.push(chunk));
                req.on("end", () => {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(
                        JSON.stringify({
                            method: req.method,
                            body: Buffer.concat(chunks).toString(),
                            contentType: req.headers["content-type"] || null,
                            testHeader: req.headers["x-test-header"] || null,
                        })
                    );
                });
                return;
            }

            if (req.url === "/auth") {
                const authorized = req.headers.authorization === "Basic dXNlcjpwYXNz";
                res.writeHead(authorized ? 200 : 401, { "Content-Type": "text/plain" });
                res.end(authorized ? "authorized" : "unauthorized");
                return;
            }

            res.writeHead(404);
            res.end("not found");
        });

        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;

        proxyServer = http.createServer(async (req, res) => {
            proxyRequests.push(req.url);
            const response = await fetch(req.url);
            res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
            res.end(await response.arrayBuffer());
        });
        await new Promise((resolve) => proxyServer.listen(0, "127.0.0.1", resolve));
        proxyUrl = `http://127.0.0.1:${proxyServer.address().port}`;

        const certDir = path.join(process.cwd(), "test/manual-test-radius-tls/certs");
        tlsServer = Bun.serve({
            hostname: "127.0.0.1",
            port: 0,
            tls: {
                cert: fs.readFileSync(path.join(certDir, "redis.crt")),
                key: fs.readFileSync(path.join(certDir, "redis.key")),
            },
            fetch: () => new Response("self-signed-ok"),
        });
        tlsUrl = `https://127.0.0.1:${tlsServer.port}`;
    });

    afterAll(async () => {
        tlsServer.stop(true);
        await new Promise((resolve) => proxyServer.close(resolve));
        await new Promise((resolve) => server.close(resolve));
    });

    test("returns parsed JSON on success", async () => {
        const res = await httpClient.request({
            url: `${baseUrl}/ok`,
            validateStatus: (status) => status === 200,
        });

        expect(res.status).toBe(200);
        expect(res.data).toEqual({ ok: true });
    });

    test("aborts requests on timeout", async () => {
        await expect(
            httpClient.request({
                url: `${baseUrl}/slow`,
                timeout: 25,
            })
        ).rejects.toThrow(/timeout/);
    });

    test("follows redirects up to maxRedirects", async () => {
        const res = await httpClient.request({
            url: `${baseUrl}/redirect`,
            maxRedirects: 1,
        });

        expect(res.status).toBe(200);
        expect(res.data).toEqual({ ok: true });
    });

    test("fails when maxRedirects is exceeded", async () => {
        await expect(
            httpClient.request({
                url: `${baseUrl}/redirect`,
                maxRedirects: 0,
            })
        ).rejects.toMatchObject({ code: "ERR_FR_TOO_MANY_REDIRECTS" });
    });

    test("exposes HTTP error response body", async () => {
        try {
            await httpClient.request({
                url: `${baseUrl}/error`,
                validateStatus: (status) => status < 500,
            });
            expect.unreachable();
        } catch (error) {
            expect(error.response.status).toBe(503);
            expect(error.response.data).toEqual({ error: "unavailable" });
        }
    });

    test("converts POST to GET when following 303 redirects", async () => {
        const res = await httpClient.post(`${baseUrl}/post-redirect`, { hello: "world" });

        expect(res.status).toBe(200);
        expect(res.data).toEqual({ method: "GET" });
    });

    test("preserves methods, custom headers, request bodies, and content types", async () => {
        const head = await httpClient.request({ url: `${baseUrl}/echo`, method: "HEAD" });
        const post = await httpClient.request({
            url: `${baseUrl}/echo`,
            method: "POST",
            data: { hello: "world" },
            headers: { "X-Test-Header": "present" },
        });

        expect(head.status).toBe(200);
        expect(head.data).toBe("");
        expect(post.data).toEqual({
            method: "POST",
            body: '{"hello":"world"}',
            contentType: "application/json",
            testHeader: "present",
        });
    });

    test("accepts configured status ranges and rejects the same status otherwise", async () => {
        const accepted = await httpClient.request({
            url: `${baseUrl}/teapot`,
            validateStatus: (status) => status >= 400 && status < 500,
        });
        expect(accepted.status).toBe(418);

        await expect(httpClient.get(`${baseUrl}/teapot`)).rejects.toMatchObject({
            response: { status: 418, data: "teapot" },
        });
    });

    test("sends HTTP basic authentication headers", async () => {
        const response = await httpClient.get(`${baseUrl}/auth`, {
            headers: { Authorization: "Basic dXNlcjpwYXNz" },
        });
        expect(response.data).toBe("authorized");

        await expect(httpClient.get(`${baseUrl}/auth`)).rejects.toMatchObject({ response: { status: 401 } });
    });

    test("detects timeout cancellations via isCancel", async () => {
        try {
            await httpClient.request({
                url: `${baseUrl}/slow`,
                timeout: 25,
            });
            expect.unreachable();
        } catch (error) {
            expect(httpClient.isCancel(error)).toBe(true);
        }
    });

    test("rejects unsupported Axios transport options explicitly", async () => {
        await expect(
            httpClient.request({
                url: `${baseUrl}/ok`,
                httpsAgent: {},
            })
        ).rejects.toMatchObject({ code: "ERR_UNSUPPORTED_HTTP_OPTION" });
    });

    test("monitor keyword path can read response text through fetch wrapper", async () => {
        const monitor = R.convertToBean("monitor");
        monitor.auth_method = null;

        const res = await monitor.makeHttpMonitorRequest({
            url: `${baseUrl}/keyword`,
            timeout: 1000,
            validateStatus: (status) => status === 200,
        });

        expect(res.data.includes("expected-keyword")).toBe(true);
    });

    test("monitor rejects unsupported fetch transport settings explicitly", async () => {
        const monitor = R.convertToBean("monitor");
        monitor.auth_method = "mtls";

        await expect(monitor.assertFetchHttpTransportSupported()).rejects.toThrow(
            /mTLS monitor authentication is not supported/
        );
    });

    test("Bun HTTP client routes requests through a local proxy", async () => {
        const response = await httpClient.get(`${baseUrl}/ok`, { proxy: proxyUrl });

        expect(response.data).toEqual({ ok: true });
        expect(proxyRequests).toContain(`${baseUrl}/ok`);
    });

    test("monitor maps an active persisted proxy to Bun fetch options", async () => {
        const monitor = R.convertToBean("monitor", {
            auth_method: null,
            proxy_id: 7,
            ignore_tls: 0,
            ip_family: null,
        });
        const originalLoad = R.load;
        R.load = async () => ({
            active: true,
            protocol: "http",
            host: "127.0.0.1",
            port: proxyServer.address().port,
            auth: false,
        });

        try {
            const options = { url: `${baseUrl}/ok` };
            await monitor.assertFetchHttpTransportSupported(options);
            expect(options.proxy).toBe(`${proxyUrl}/`);
            expect((await monitor.makeHttpMonitorRequest(options)).data).toEqual({ ok: true });
        } finally {
            R.load = originalLoad;
        }
    });

    test("monitor honors ignoreTls against a deterministic self-signed TLS fixture", async () => {
        const monitor = R.convertToBean("monitor");
        monitor.auth_method = null;
        monitor.proxy_id = null;
        monitor.ignoreTls = true;
        monitor.ipFamily = null;
        const options = { url: tlsUrl };

        await expect(httpClient.get(tlsUrl)).rejects.toThrow();
        await monitor.assertFetchHttpTransportSupported(options);
        const response = await monitor.makeHttpMonitorRequest(options);

        expect(response.data).toBe("self-signed-ok");
    });

    test("HTTP monitor UI does not offer forced IP family unsupported by Bun fetch", () => {
        const component = fs.readFileSync(
            path.join(process.cwd(), "src/components/edit-monitor/EditMonitorAdvanced.vue"),
            "utf8"
        );

        expect(component).not.toContain('<option value="ipv4">IPv4</option>');
        expect(component).not.toContain('<option value="ipv6">IPv6</option>');
    });

    test("persisted forced HTTP IP family remains explicitly rejected", async () => {
        const monitor = R.convertToBean("monitor");
        monitor.auth_method = null;
        monitor.proxy_id = null;
        monitor.ignoreTls = false;
        monitor.ipFamily = "ipv4";

        await expect(monitor.assertFetchHttpTransportSupported({})).rejects.toThrow(/Forced IP family/);
    });

    test("saved response size behavior remains truncation after the response is read", async () => {
        const monitor = R.convertToBean("monitor");
        monitor.response_max_length = 5;
        const bean = {};

        await monitor.saveResponseData(bean, "abcdef");

        expect(await R.dispense("heartbeat").constructor.decodeResponseValue(bean.response)).toBe(
            "abcde... (truncated)"
        );
    });
});
