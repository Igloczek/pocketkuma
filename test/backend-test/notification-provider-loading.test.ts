// @ts-nocheck

import { describe, test, expect } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getNotificationProviderModuleMap, NOTIFICATION_PROVIDER_REGISTRY } from "@/notification-provider-metadata";
import { NotificationProviderRegistry, OPTIONAL_NOTIFICATION_PROVIDERS } from "@/server/notification-provider-registry";
import { Notification } from "@/server/notification";

const registrySourcePath = path.join(import.meta.dirname, "../../src/server/notification-provider-registry.ts");
const monitorRegistrySourcePath = path.join(import.meta.dirname, "../../src/server/monitor-runtime-registry.ts");
const providersDir = path.join(import.meta.dirname, "../../src/server/notification-providers");
const settings = { get: async () => null, set: async () => {}, setSettings: async () => {} };

describe("notification provider compile-safe loading", () => {
    test("registry source does not use template-string dynamic imports", () => {
        const source = fs.readFileSync(registrySourcePath, "utf8");

        // This pattern is what bun build --compile cannot resolve into the binary.
        expect(source).not.toMatch(/import\s*\(\s*`\.\/notification-providers\/\$\{/);
    });

    test("compile-safe loader dynamic imports keep literal specifiers", () => {
        for (const sourcePath of [registrySourcePath, monitorRegistrySourcePath]) {
            const source = fs.readFileSync(sourcePath, "utf8");
            const imports = [...source.matchAll(/\bimport\s*\(\s*([^)]*?)\s*\)/g)]
                .map((match) => match[1])
                .filter((specifier) => specifier.trim());

            expect(imports.length).toBeGreaterThan(0);
            for (const specifier of imports) {
                expect(specifier).toMatch(/^["'][^"']+["']$/);
            }
        }
    });

    test("every metadata provider has an on-disk module and loads through the registry", async () => {
        const moduleMap = getNotificationProviderModuleMap();
        const providers = new NotificationProviderRegistry(settings);

        const registryKeys = Object.keys(NOTIFICATION_PROVIDER_REGISTRY).sort();
        const optionalKeys = [...OPTIONAL_NOTIFICATION_PROVIDERS].sort();

        expect(optionalKeys).toEqual(registryKeys);

        for (const [name, moduleName] of Object.entries(moduleMap)) {
            const modulePath = path.join(providersDir, `${moduleName}.ts`);
            expect(fs.existsSync(modulePath)).toBe(true);

            const source = fs.readFileSync(modulePath, "utf8");
            expect(source).toContain("export default");

            const provider = await providers.get(name);
            expect(provider.name).toBe(name);
            expect(typeof provider.send).toBe("function");
        }

        expect(providers.getLoadedProviders().sort()).toEqual(registryKeys);
    });

    test("compiled artifact loads every monitor and notification provider factory", async () => {
        const registryKeys = Object.keys(NOTIFICATION_PROVIDER_REGISTRY);
        const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "pocketkuma-loader-smoke-"));
        const outputPath = path.join(outputDir, "loader-smoke");

        try {
            const build = await Bun.build({
                entrypoints: [path.join(import.meta.dirname, "compiled-loader-smoke.ts")],
                compile: { outfile: outputPath },
                external: ["chromium-bidi/*", "deasync"],
                define: { "process.env.NODE_ENV": JSON.stringify("production") },
                minify: true,
            });
            expect(build.success).toBe(true);

            const smoke = Bun.spawn([outputPath], { stdout: "pipe", stderr: "pipe" });
            const [stdout, stderr] = await Promise.all([
                new Response(smoke.stdout).text(),
                new Response(smoke.stderr).text(),
            ]);
            expect(await smoke.exited, stderr).toBe(0);

            const result = JSON.parse(stdout.trim());
            expect(result.monitors).toBeGreaterThan(0);
            expect(result.notificationProviders).toBe(registryKeys.length);
        } finally {
            fs.rmSync(outputDir, { recursive: true, force: true });
        }
    }, 120_000);

    test("Notification.send resolves smtp provider instead of missing-module error", async () => {
        const providers = new NotificationProviderRegistry(settings);
        let captured = null;
        const provider = await providers.get("smtp");
        const originalSend = provider.send.bind(provider);
        provider.send = async (notification, msg) => {
            captured = { type: notification.type, msg };
            return "Sent Successfully.";
        };

        try {
            const result = await Notification.send(
                providers,
                {
                    type: "smtp",
                    name: "Email",
                    smtpHost: "localhost",
                    smtpPort: 25,
                    smtpFrom: "test@example.com",
                    smtpTo: "dest@example.com",
                },
                "PocketKuma Test"
            );

            expect(result).toBe("Sent Successfully.");
            expect(captured).toEqual({ type: "smtp", msg: "PocketKuma Test" });
        } finally {
            provider.send = originalSend;
        }
    });

    test("unknown provider type returns null and Notification.send throws clearly", async () => {
        const providers = new NotificationProviderRegistry(settings);
        expect(await providers.get("definitely-not-a-provider")).toBeNull();

        await expect(
            Notification.send(
                providers,
                {
                    type: "definitely-not-a-provider",
                    name: "Broken",
                },
                "test"
            )
        ).rejects.toThrow("Notification type is not supported");
    });

    test("Notification.send uses the provider registry passed by its runtime", async () => {
        const createRegistry = (runtime) =>
            new NotificationProviderRegistry(settings, {
                test: async () => ({
                    default: class {
                        name = "test";
                        send() {
                            return runtime;
                        }
                    },
                }),
            });
        const first = createRegistry("first");
        const second = createRegistry("second");

        expect(await Notification.send(first, { type: "test" }, "message")).toBe("first");
        expect(await Notification.send(second, { type: "test" }, "message")).toBe("second");
        expect(first.getLoadedProviders()).toEqual(["test"]);
        expect(second.getLoadedProviders()).toEqual(["test"]);
    });
});
