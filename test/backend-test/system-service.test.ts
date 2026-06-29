// @ts-nocheck

/**
 * Check if the test should be skipped.
 * @returns {boolean} True if the test should be skipped
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { SystemServiceMonitorType } from "../../src/server/monitor-types/system-service.ts";
import { DOWN, UP } from "../../src/util.ts";
import process from "process";
import { execSync } from "node:child_process";

function shouldSkip() {
    if (process.platform === "win32") {
        return false;
    }
    if (process.platform !== "linux") {
        return true;
    }

    // We currently only support systemd as an init system on linux
    // -> Check if PID 1 is systemd (or init which maps to systemd)
    try {
        const pid1Comm = execSync("ps -p 1 -o comm=", { encoding: "utf-8" }).trim();
        return !["systemd", "init"].includes(pid1Comm);
    } catch (e) {
        return true;
    }
}

describe.skipIf(shouldSkip())("SystemServiceMonitorType", () => {
    let monitorType;
    let heartbeat;
    let originalPlatform;

    beforeEach(() => {
        monitorType = new SystemServiceMonitorType();
        heartbeat = {
            status: DOWN,
            msg: "",
        };
        originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    });

    afterEach(() => {
        if (originalPlatform) {
            Object.defineProperty(process, "platform", originalPlatform);
        }
    });

    test("check() returns UP for a running service", async () => {
        // Windows: 'Dnscache' is always running.
        // Linux: 'dbus' or 'cron' are standard services.
        const serviceName = process.platform === "win32" ? "Dnscache" : "dbus";

        const monitor = {
            system_service_name: serviceName,
        };

        await monitorType.check(monitor, heartbeat);

        expect(heartbeat.status).toBe(UP);
        expect(heartbeat.msg.includes("is running")).toBeTruthy();
    });

    test("check() returns DOWN for a stopped service", async () => {
        const monitor = {
            system_service_name: "non-existent-service-12345",
        };

        // Query a non-existent service to force an error/down state.
        // Pass the promise directly to expect().rejects without an unnecessary async wrapper.
        await expect(monitorType.check(monitor, heartbeat)).rejects.toThrow();

        expect(heartbeat.status).toBe(DOWN);
    });

    test("check() fails gracefully with invalid characters", async () => {
        // Mock platform for validation logic test
        Object.defineProperty(process, "platform", {
            value: "linux",
            configurable: true,
        });

        const monitor = {
            system_service_name: "invalid&service;name",
        };

        // Expected validation error
        await expect(monitorType.check(monitor, heartbeat)).rejects.toThrow();

        expect(heartbeat.status).toBe(DOWN);
    });

    test("check() throws on unsupported platforms", async () => {
        // This test mocks the platform, so it can run anywhere.
        Object.defineProperty(process, "platform", {
            value: "darwin",
            configurable: true,
        });

        const monitor = {
            system_service_name: "test-service",
        };

        await expect(monitorType.check(monitor, heartbeat)).rejects.toThrow(/not supported/);
    });
});
