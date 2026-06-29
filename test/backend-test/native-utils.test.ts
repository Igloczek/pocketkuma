// @ts-nocheck

import { describe, test, expect } from "bun:test";
import jwt from "@/server/jwt";
import { verify as verifyTotp, encodeSecretForUri } from "@/server/totp";
import { passwordStrength } from "@/util/password-strength";
import { TokenBucket } from "@/server/rate-limiter";
import { isIP } from "@/util/is-ip";
import { isFQDN } from "@/util/is-fqdn";
import isUrl from "@/util/is-url";
import { compare as compareVersions } from "@/util/version-compare";
import { randomId } from "@/util/random-id";

const editMonitorFqdnOptions = {
    allow_wildcard: true,
    require_tld: false,
    allow_underscores: true,
    allow_trailing_dot: true,
};

describe("native JWT", () => {
    test("signs and verifies object payloads", () => {
        const token = jwt.sign({ username: "admin", h: "abc123" }, "secret");
        expect(jwt.verify(token, "secret")).toEqual({ username: "admin", h: "abc123" });
    });

    test("signs and verifies numeric payloads", () => {
        const token = jwt.sign(42, "secret");
        expect(jwt.verify(token, "secret")).toBe(42);
    });

    test("rejects invalid signatures", () => {
        const token = jwt.sign({ ok: true }, "secret");
        expect(() => jwt.verify(token, "wrong-secret")).toThrow("invalid signature");
    });

    test("rejects non-HS256 algorithms", () => {
        const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" })).replace(/=+$/, "");
        const payload = btoa(JSON.stringify({ user: "x" })).replace(/=+$/, "");
        const token = `${header}.${payload}.`;
        expect(() => jwt.verify(token, "secret")).toThrow("invalid algorithm");
    });
});

describe("native TOTP", () => {
    test("encodeSecretForUri strips padding", () => {
        const secret = "test-secret-bytes";
        expect(encodeSecretForUri(secret).includes("=")).toBe(false);
    });

    test("verify accepts the current token for a known secret", () => {
        const secret = "ABCDEFGHIJKLMNOP";
        const step = 30;
        const counter = Math.floor(Date.now() / 1000 / step);
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setUint32(4, counter, false);
        const hmac = new Bun.CryptoHasher("sha1", new TextEncoder().encode(secret));
        hmac.update(new Uint8Array(buffer));
        const digest = hmac.digest();
        const offset = digest[digest.length - 1] & 0x0f;
        const code =
            ((digest[offset] & 0x7f) << 24) |
            ((digest[offset + 1] & 0xff) << 16) |
            ((digest[offset + 2] & 0xff) << 8) |
            (digest[offset + 3] & 0xff);
        const token = String(code % 1000000).padStart(6, "0");

        expect(verifyTotp(token, secret, { window: 0, time: step })).toBe(true);
    });
});

describe("password strength", () => {
    test("matches expected labels", () => {
        expect(passwordStrength("123").value).toBe("Too weak");
        expect(passwordStrength("abc123").value).toBe("Weak");
        expect(passwordStrength("Abc12345").value).toBe("Medium");
        expect(passwordStrength("Abc12345!@").value).toBe("Strong");
    });
});

describe("token bucket rate limiter", () => {
    test("depletes tokens and refills over time", () => {
        const bucket = new TokenBucket({
            tokensPerInterval: 2,
            interval: 1000,
            fireImmediately: true,
        });

        expect(bucket.removeTokens(1)).toBe(1);
        expect(bucket.removeTokens(1)).toBe(0);
        expect(bucket.removeTokens(1)).toBe(-1);

        bucket.lastRefill = Date.now() - 2000;
        expect(bucket.removeTokens(1)).toBe(1);
    });
});

describe("validator replacements", () => {
    test("isIP rejects CIDR notation", () => {
        expect(isIP("192.168.1.1")).toBe(true);
        expect(isIP("192.168.1.1/24")).toBe(false);
        expect(isIP("::1/128")).toBe(false);
    });

    test("isFQDN matches EditMonitor option set", () => {
        expect(isFQDN("_bad.com", editMonitorFqdnOptions)).toBe(true);
        expect(isFQDN("host.example", editMonitorFqdnOptions)).toBe(true);
        expect(isFQDN("bad..host", editMonitorFqdnOptions)).toBe(false);
    });

    test("isUrl matches is-url package behavior", () => {
        expect(isUrl("https://example.com")).toBe(true);
        expect(isUrl("https://foo")).toBe(false);
        expect(isUrl("ftp://x.com")).toBe(true);
        expect(isUrl("not-a-url")).toBe(false);
    });
});

describe("version compare", () => {
    test("treats pre-release versions as lower than release", () => {
        expect(compareVersions("1.0.0-beta", "1.0.0", "<")).toBe(true);
        expect(compareVersions("1.0.0", "1.0.0-beta", ">")).toBe(true);
    });
});

describe("randomId", () => {
    test("generates requested length using allowed alphabet", () => {
        const id = randomId(40);
        expect(id).toHaveLength(40);
        expect(id).toMatch(/^[A-Za-z0-9]+$/);
    });
});
