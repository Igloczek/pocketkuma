// @ts-nocheck

import { describe, test, expect } from "bun:test";
import {
    NOTIFICATION_PROVIDER_CATEGORIES,
    NOTIFICATION_PROVIDER_REGISTRY,
    buildNotificationNameList,
    getNotificationProviderModuleMap,
} from "@/notification-provider-metadata";
import { OPTIONAL_NOTIFICATION_PROVIDERS } from "@/server/notification-provider-registry";

describe("notification provider metadata", () => {
    test("registry keys match server provider list and frontend forms", () => {
        const registryKeys = Object.keys(NOTIFICATION_PROVIDER_REGISTRY).sort();
        const serverKeys = [...OPTIONAL_NOTIFICATION_PROVIDERS].sort();
        const moduleMapKeys = Object.keys(getNotificationProviderModuleMap()).sort();

        expect(registryKeys).toEqual(serverKeys);
        expect(registryKeys).toEqual(moduleMapKeys);
        // notifications/index.ts maps the same provider keys (lazy-loaded); verified at build time.
    });

    test("every provider has a display label and at least one category", () => {
        const categoryIds = new Set(NOTIFICATION_PROVIDER_CATEGORIES.map((category) => category.id));

        for (const [providerKey, meta] of Object.entries(NOTIFICATION_PROVIDER_REGISTRY)) {
            expect(meta.module).toBeTruthy();
            expect(meta.label || meta.labelKey).toBeTruthy();
            expect(meta.categories.length).toBeGreaterThan(0);
            for (const category of meta.categories) {
                expect(categoryIds.has(category)).toBe(true);
            }
            expect(providerKey).toBeTruthy();
        }
    });

    test("buildNotificationNameList groups providers by category", () => {
        const groups = buildNotificationNameList((key) => key);

        for (const category of NOTIFICATION_PROVIDER_CATEGORIES) {
            expect(groups[category.id]).toBeTruthy();
        }

        expect(groups.universal.apprise).toBe("apprise");
        expect(groups.chatPlatforms.telegram).toBe("Telegram");
        expect(groups.pushServices.gorush).toBe("Gorush");
        expect(groups.incidentManagement.gorush).toBeUndefined();
    });
});
