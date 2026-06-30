// @ts-nocheck

import { describe, test, expect } from "bun:test";
import { RADIUS_ATTRS } from "@/server/radius-attrs";
import { radius } from "@/server/util-server";

describe("RADIUS monitor", () => {
    test("uses RFC 2865 attribute names", () => {
        expect(RADIUS_ATTRS.USER_NAME).toBe("User-Name");
        expect(RADIUS_ATTRS.USER_PASSWORD).toBe("User-Password");
        expect(RADIUS_ATTRS.CALLING_STATION_ID).toBe("Calling-Station-Id");
        expect(RADIUS_ATTRS.CALLED_STATION_ID).toBe("Called-Station-Id");
    });

    test("rejects when radius server is not reachable", async () => {
        await expect(
            radius("127.0.0.1", "user", "pass", "called", "calling", "secret", 1, 50)
        ).rejects.toThrow(/RADIUS authentication failed|RADIUS request timeout|Failed to send RADIUS request/);
    });
});