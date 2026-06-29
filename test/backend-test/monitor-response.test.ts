// @ts-nocheck

import { describe, test, expect } from "bun:test";
import Monitor from "../../src/server/model/monitor.ts";
import Heartbeat from "../../src/server/model/heartbeat.ts";
import { RESPONSE_BODY_LENGTH_DEFAULT } from "../../src/util.ts";

describe("Monitor response saving", () => {
    test("getSaveResponse and getSaveErrorResponse parse booleans", () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.save_response = 1;
        monitor.save_error_response = 0;

        expect(monitor.getSaveResponse()).toBe(true);
        expect(monitor.getSaveErrorResponse()).toBe(false);
    });

    test("saveResponseData stores and truncates response", async () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.response_max_length = 5;

        const bean = {};
        await monitor.saveResponseData(bean, "abcdef");

        expect(await Heartbeat.decodeResponseValue(bean.response)).toBe("abcde... (truncated)");
    });

    test("saveResponseData stringifies objects", async () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.response_max_length = RESPONSE_BODY_LENGTH_DEFAULT;

        const bean = {};
        await monitor.saveResponseData(bean, { ok: true });

        expect(await Heartbeat.decodeResponseValue(bean.response)).toBe(JSON.stringify({ ok: true }));
    });
});
