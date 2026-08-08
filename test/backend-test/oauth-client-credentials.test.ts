// @ts-nocheck

import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { getOAuthClientCredentialsToken } from "@/server/oauth-client-credentials";

let server;
let baseUrl;
const requests = [];

beforeAll(() => {
    server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(request) {
            const url = new URL(request.url);
            const body = await request.text();
            requests.push({ path: url.pathname, method: request.method, headers: request.headers, body });

            if (url.pathname === "/basic") {
                return Response.json({
                    access_token: "basic-token",
                    token_type: "Bearer",
                    expires_in: "60",
                    custom_claim: "kept",
                });
            }
            if (url.pathname === "/post") {
                return Response.json({ access_token: "post-token", token_type: "Bearer" });
            }
            if (url.pathname === "/oauth-error") {
                return Response.json({ error: "invalid_client", error_description: "wrong client" }, { status: 401 });
            }
            if (url.pathname === "/http-error") {
                return new Response("do not expose this body", { status: 418, statusText: "Teapot" });
            }
            if (url.pathname === "/non-json") {
                return new Response("not json", { status: 200, headers: { "Content-Type": "text/plain" } });
            }
            if (url.pathname === "/redirect") {
                return new Response(null, { status: 302, statusText: "Found", headers: { Location: "/basic" } });
            }
            if (url.pathname === "/slow") {
                await Bun.sleep(100);
                return Response.json({ access_token: "too-late", token_type: "Bearer" });
            }
            if (url.pathname === "/slow-body") {
                const encoder = new TextEncoder();
                let timer;
                return new Response(
                    new ReadableStream({
                        start(controller) {
                            controller.enqueue(encoder.encode('{"access_token":"'));
                            timer = setTimeout(() => {
                                controller.enqueue(encoder.encode('too-late","token_type":"Bearer"}'));
                                controller.close();
                            }, 100);
                        },
                        cancel() {
                            clearTimeout(timer);
                        },
                    }),
                    { headers: { "Content-Type": "application/json" } }
                );
            }
            return new Response("not found", { status: 404 });
        },
    });
    baseUrl = `http://127.0.0.1:${server.port}`;
});

afterAll(() => server.stop(true));

describe("OAuth client credentials", () => {
    test("uses encoded Basic credentials and preserves the complete token response", async () => {
        const now = spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
        try {
            const token = await getOAuthClientCredentialsToken(
                `${baseUrl}/basic`,
                "client id!~*'(),:/+%ż",
                "secret value!~*'(),:/+%密",
                "read write",
                "https://api.example/audience",
                "client_secret_basic"
            );

            expect(token).toEqual({
                access_token: "basic-token",
                token_type: "Bearer",
                expires_in: "60",
                custom_claim: "kept",
                expires_at: 1_700_000_060,
            });
            const request = requests.at(-1);
            expect(request.method).toBe("POST");
            expect(request.headers.get("accept")).toBe("application/json");
            expect(request.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
            expect(request.headers.get("authorization")).toBe(
                `Basic ${Buffer.from("client+id!~*'()%2C%3A%2F%2B%25%C5%BC:secret+value!~*'()%2C%3A%2F%2B%25%E5%AF%86").toString("base64")}`
            );
            expect(Object.fromEntries(new URLSearchParams(request.body))).toEqual({
                grant_type: "client_credentials",
                scope: "read write",
                audience: "https://api.example/audience",
            });
        } finally {
            now.mockRestore();
        }
    });

    test("sends client_secret_post credentials in the form and leaves tokens without expiry untouched", async () => {
        const token = await getOAuthClientCredentialsToken(
            `${baseUrl}/post`,
            "client id",
            "secret value",
            "read",
            "audience",
            "client_secret_post"
        );

        expect(token).toEqual({ access_token: "post-token", token_type: "Bearer" });
        const request = requests.at(-1);
        expect(request.headers.get("authorization")).toBeNull();
        expect(Object.fromEntries(new URLSearchParams(request.body))).toEqual({
            grant_type: "client_credentials",
            scope: "read",
            audience: "audience",
            client_id: "client id",
            client_secret: "secret value",
        });
    });

    test("reports OAuth errors, non-JSON responses, non-OAuth status errors, and redirects", async () => {
        await expect(getOAuthClientCredentialsToken(`${baseUrl}/oauth-error`, "id", "secret")).rejects.toEqual(
            new Error("invalid_client (wrong client)")
        );
        await expect(getOAuthClientCredentialsToken(`${baseUrl}/non-json`, "id", "secret")).rejects.toThrow("non-JSON");
        await expect(getOAuthClientCredentialsToken(`${baseUrl}/http-error`, "id", "secret")).rejects.toEqual(
            new Error("expected 200 OK, got: 418 I'm a Teapot")
        );
        await expect(getOAuthClientCredentialsToken(`${baseUrl}/redirect`, "id", "secret")).rejects.toEqual(
            new Error("expected 200 OK, got: 302 Found")
        );
    });

    test("times out slow requests and normalizes invalid timeouts", async () => {
        await expect(
            getOAuthClientCredentialsToken(`${baseUrl}/slow`, "id", "secret", undefined, undefined, undefined, 10)
        ).rejects.toThrow("timed out after 10ms");
        await expect(
            getOAuthClientCredentialsToken(`${baseUrl}/slow-body`, "id", "secret", undefined, undefined, undefined, 10)
        ).rejects.toThrow("timed out after 10ms");
        await expect(
            getOAuthClientCredentialsToken(`${baseUrl}/basic`, "id", "secret", undefined, undefined, undefined, 0)
        ).resolves.toMatchObject({
            access_token: "basic-token",
        });
    });

    test("rejects unsupported authentication methods and non-HTTP token endpoints", async () => {
        await expect(
            getOAuthClientCredentialsToken(`${baseUrl}/basic`, "id", "secret", undefined, undefined, "private_key_jwt")
        ).rejects.toThrow("Unsupported OAuth client authentication method");
        await expect(getOAuthClientCredentialsToken("mailto:oauth@example.com", "id", "secret")).rejects.toThrow(
            "absolute HTTP(S) URL"
        );
        await expect(getOAuthClientCredentialsToken(`${baseUrl}/basic`, undefined, "secret")).rejects.toThrow(
            "client ID must be a non-empty string"
        );
        await expect(getOAuthClientCredentialsToken(`${baseUrl}/basic`, "id", undefined)).rejects.toThrow(
            "client secret must be a string"
        );
    });
});
