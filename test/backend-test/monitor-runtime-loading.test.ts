// @ts-nocheck

import { describe, test } from "node:test";
import assert from "node:assert";
import * as registry from "../../src/server/monitor-runtime-registry.ts";
import { Notification } from "../../src/server/notification.ts";
import * as notificationRegistry from "../../src/server/notification-provider-registry.ts";

describe("monitor runtime lazy loading", () => {
    test("startup metadata does not import optional monitor implementations", () => {
        registry.createMonitorTypeList();

        assert.deepStrictEqual(registry.getLoadedMonitorTypes(), []);
    });

    test("notification init registers providers without importing provider modules", () => {
        Notification.init();

        assert.deepStrictEqual(notificationRegistry.getLoadedNotificationProviders(), []);
    });
});
