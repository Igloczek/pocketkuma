// @ts-nocheck

import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import http from "node:http";
import httpClient from "../../src/server/http-client.ts";
import Monitor from "../../src/server/model/monitor.ts";
import Heartbeat from "../../src/server/model/heartbeat.ts";

describe("fetch HTTP client", () => {
    let server;
    let baseUrl;

    before(async () => {
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

    after(async () => {
        await new Promise((resolve) => server.close(resolve));
    });

    test("returns parsed JSON on success", async () => {
        const res = await httpClient.request({
            url: `${baseUrl}/ok`,
            validateStatus: (status) => status === 200,
        });

        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(res.data, { ok: true });
    });

    test("aborts requests on timeout", async () => {
        await assert.rejects(
            httpClient.request({
                url: `${baseUrl}/slow`,
                timeout: 25,
            }),
            /timeout/
        );
    });

    test("follows redirects up to maxRedirects", async () => {
        const res = await httpClient.request({
            url: `${baseUrl}/redirect`,
            maxRedirects: 1,
        });

        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(res.data, { ok: true });
    });

    test("fails when maxRedirects is exceeded", async () => {
        await assert.rejects(
            httpClient.request({
                url: `${baseUrl}/redirect`,
                maxRedirects: 0,
            }),
            (error) => error.code === "ERR_FR_TOO_MANY_REDIRECTS"
        );
    });

    test("exposes HTTP error response body", async () => {
        await assert.rejects(
            httpClient.request({
                url: `${baseUrl}/error`,
                validateStatus: (status) => status < 500,
            }),
            (error) => {
                assert.strictEqual(error.response.status, 503);
                assert.deepStrictEqual(error.response.data, { error: "unavailable" });
                return true;
            }
        );
    });

    test("rejects unsupported Axios transport options explicitly", async () => {
        await assert.rejects(
            httpClient.request({
                url: `${baseUrl}/ok`,
                httpsAgent: {},
            }),
            (error) => error.code === "ERR_UNSUPPORTED_HTTP_OPTION"
        );
    });

    test("monitor keyword path can read response text through fetch wrapper", async () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.auth_method = null;

        const res = await monitor.makeHttpMonitorRequest({
            url: `${baseUrl}/keyword`,
            timeout: 1000,
            validateStatus: (status) => status === 200,
        });

        assert.strictEqual(res.data.includes("expected-keyword"), true);
    });

    test("monitor rejects unsupported fetch transport settings explicitly", async () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.auth_method = "mtls";

        await assert.rejects(
            monitor.assertFetchHttpTransportSupported(),
            /mTLS monitor authentication is not supported/
        );
    });

    test("saved response size behavior remains truncation after the response is read", async () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.response_max_length = 5;
        const bean = {};

        await monitor.saveResponseData(bean, "abcdef");

        assert.strictEqual(await Heartbeat.decodeResponseValue(bean.response), "abcde... (truncated)");
    });
});
