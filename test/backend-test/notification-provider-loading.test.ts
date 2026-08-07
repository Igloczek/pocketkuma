// @ts-nocheck

import { describe, test, expect, beforeEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { getNotificationProviderModuleMap, NOTIFICATION_PROVIDER_REGISTRY } from "@/notification-provider-metadata";
import {
    OPTIONAL_NOTIFICATION_PROVIDERS,
    getNotificationProvider,
    getLoadedNotificationProviders,
    resetLoadedNotificationProvidersForTests,
} from "@/server/notification-provider-registry";
import { Notification } from "@/server/notification";

const registrySourcePath = path.join(import.meta.dirname, "../../src/server/notification-provider-registry.ts");
const monitorRegistrySourcePath = path.join(import.meta.dirname, "../../src/server/monitor-runtime-registry.ts");
const providersDir = path.join(import.meta.dirname, "../../src/server/notification-providers");

describe("notification provider compile-safe loading", () => {
    beforeEach(() => {
        resetLoadedNotificationProvidersForTests();
    });

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

        const registryKeys = Object.keys(NOTIFICATION_PROVIDER_REGISTRY).sort();
        const optionalKeys = [...OPTIONAL_NOTIFICATION_PROVIDERS].sort();

        expect(optionalKeys).toEqual(registryKeys);

        for (const [name, moduleName] of Object.entries(moduleMap)) {
            const modulePath = path.join(providersDir, `${moduleName}.ts`);
            expect(fs.existsSync(modulePath)).toBe(true);

            const source = fs.readFileSync(modulePath, "utf8");
            expect(source).toContain("export default");

            const provider = await getNotificationProvider(name);
            expect(provider.name).toBe(name);
            expect(typeof provider.send).toBe("function");
        }

        expect(getLoadedNotificationProviders().sort()).toEqual(registryKeys);
    });

    test("Notification.send resolves smtp provider instead of missing-module error", async () => {
        Notification.init();

        let captured = null;
        const provider = await getNotificationProvider("smtp");
        const originalSend = provider.send.bind(provider);
        provider.send = async (notification, msg) => {
            captured = { type: notification.type, msg };
            return "Sent Successfully.";
        };

        try {
            const result = await Notification.send(
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
        expect(await getNotificationProvider("definitely-not-a-provider")).toBeNull();

        await expect(
            Notification.send(
                {
                    type: "definitely-not-a-provider",
                    name: "Broken",
                },
                "test"
            )
        ).rejects.toThrow("Notification type is not supported");
    });
});
