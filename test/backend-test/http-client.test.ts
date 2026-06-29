// @ts-nocheck

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import http from "node:http";
import httpClient from "../../src/server/http-client.ts";
import Monitor from "../../src/server/model/monitor.ts";
import Heartbeat from "../../src/server/model/heartbeat.ts";

describe("fetch HTTP client", () => {
    let server;
    let baseUrl;

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

            if (req.url === "/error") {
                res.writeHead(503, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "unavailable" }));
                return;
            }

            res.writeHead(404);
            res.end("not found");
        });

        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    afterAll(async () => {
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

    test("rejects unsupported Axios transport options explicitly", async () => {
        await expect(
            httpClient.request({
                url: `${baseUrl}/ok`,
                httpsAgent: {},
            })
        ).rejects.toMatchObject({ code: "ERR_UNSUPPORTED_HTTP_OPTION" });
    });

    test("monitor keyword path can read response text through fetch wrapper", async () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.auth_method = null;

        const res = await monitor.makeHttpMonitorRequest({
            url: `${baseUrl}/keyword`,
            timeout: 1000,
            validateStatus: (status) => status === 200,
        });

        expect(res.data.includes("expected-keyword")).toBe(true);
    });

    test("monitor rejects unsupported fetch transport settings explicitly", async () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.auth_method = "mtls";

        await expect(monitor.assertFetchHttpTransportSupported()).rejects.toThrow(
            /mTLS monitor authentication is not supported/
        );
    });

    test("saved response size behavior remains truncation after the response is read", async () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.response_max_length = 5;
        const bean = {};

        await monitor.saveResponseData(bean, "abcdef");

        expect(await Heartbeat.decodeResponseValue(bean.response)).toBe("abcde... (truncated)");
    });
});
