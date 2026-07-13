// @ts-nocheck

import { describe, expect, test } from "bun:test";

import { buildProxyFetchOption, validateProxyDefinition } from "@/server/proxy-validation";

const validProxy = {
    protocol: "http",
    host: "proxy.example",
    port: 8080,
    auth: false,
    active: true,
    default: false,
};

describe("proxy trust-boundary validation", () => {
    test("accepts every declared protocol and valid DNS, IPv4, and IPv6 hosts", () => {
        for (const protocol of ["http", "https", "socks", "socks5", "socks5h", "socks4"]) {
            expect(validateProxyDefinition({ ...validProxy, protocol }).protocol).toBe(protocol);
        }

        for (const [host, normalized] of [
            ["proxy.example", "proxy.example"],
            ["127.0.0.1", "127.0.0.1"],
            ["::1", "::1"],
            ["[2001:db8::1]", "2001:db8::1"],
        ]) {
            expect(validateProxyDefinition({ ...validProxy, host }).host).toBe(normalized);
        }
    });

    test("rejects ambiguous hosts and non-integer or out-of-range ports", () => {
        for (const host of [
            "",
            " proxy.example",
            "proxy.example ",
            "proxy host",
            "http://proxy.example",
            "proxy.example/path",
            "user@proxy.example",
            "proxy.example:8080",
            "bad:host",
            "bad..host",
            "-bad.example",
            "[not-ipv6]",
        ]) {
            expect(() => validateProxyDefinition({ ...validProxy, host })).toThrow(/proxy host/i);
        }

        for (const port of [null, "8080", 0, -1, 1.5, 65536]) {
            expect(() => validateProxyDefinition({ ...validProxy, port })).toThrow(/proxy port/i);
        }
    });

    test("enforces the UI authentication contract and preserves active false", () => {
        for (const credentials of [
            { username: "", password: "secret" },
            { username: "user", password: "" },
            { username: null, password: "secret" },
            { username: "user", password: null },
        ]) {
            expect(() => validateProxyDefinition({ ...validProxy, auth: true, ...credentials })).toThrow(
                /username and password/i
            );
        }

        expect(
            validateProxyDefinition({
                ...validProxy,
                auth: false,
                username: "stale-user",
                password: "stale-password",
                active: false,
            })
        ).toMatchObject({ username: null, password: null, active: false });
    });

    test("builds URL-safe endpoints and keeps authentication in Bun's proxy-scoped option", () => {
        expect(buildProxyFetchOption(validateProxyDefinition({ ...validProxy, host: "::1" }))).toBe(
            "http://[::1]:8080/"
        );

        const username = "u%@:/żółw";
        const password = "p%@:/密碼";
        const option = buildProxyFetchOption(
            validateProxyDefinition({ ...validProxy, auth: true, username, password })
        );
        const serialized = JSON.stringify(option);

        expect(option.url).toBe("http://proxy.example:8080/");
        expect(option.headers["Proxy-Authorization"]).toBe(
            `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
        );
        expect(serialized).not.toContain(username);
        expect(serialized).not.toContain(password);
        expect(option.url).not.toContain("@");
    });
});
