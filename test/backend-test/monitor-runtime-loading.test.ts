// @ts-nocheck
const { describe, test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

describe("monitor runtime lazy loading", () => {
    test("startup metadata does not import optional monitor implementations", () => {
        const registry = require("../../src/server/monitor-runtime-registry");
        registry.createMonitorTypeList();

        const loadedOptionalMonitors = registry.OPTIONAL_MONITOR_TYPES.filter((type) => {
            const modulePath =
                {
                    "grpc-keyword": "grpc",
                    port: "tcp",
                    sqlserver: "mssql",
                }[type] || type;
            const filename = path.join("server", "monitor-types", `${modulePath}.ts`);
            return Object.keys(require.cache).some((cached) => cached.endsWith(filename));
        });

        assert.deepStrictEqual(loadedOptionalMonitors, []);
        assert.deepStrictEqual(registry.getLoadedMonitorTypes(), []);
    });

    test("notification init registers providers without importing provider modules", () => {
        const { Notification } = require("../../src/server/notification");
        const registry = require("../../src/server/notification-provider-registry");

        Notification.init();

        const providerDirectory = path.join("server", "notification-providers");
        const loadedProviders = Object.keys(require.cache).filter((cached) => cached.includes(providerDirectory));

        assert.deepStrictEqual(loadedProviders, []);
        assert.deepStrictEqual(registry.getLoadedNotificationProviders(), []);
    });
});
