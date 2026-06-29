// @ts-nocheck

import { describe, test, expect } from "bun:test";
import * as registry from "@/server/monitor-runtime-registry";
import { Notification } from "@/server/notification";
import * as notificationRegistry from "@/server/notification-provider-registry";

describe("monitor runtime lazy loading", () => {
    test("startup metadata does not import optional monitor implementations", () => {
        registry.createMonitorTypeList();

        expect(registry.getLoadedMonitorTypes()).toEqual([]);
    });

    test("notification init registers providers without importing provider modules", () => {
        notificationRegistry.resetLoadedNotificationProvidersForTests();
        Notification.init();

        expect(notificationRegistry.getLoadedNotificationProviders()).toEqual([]);
    });
});
