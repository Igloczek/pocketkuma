// @ts-nocheck

import { beforeAll, describe, expect, test } from "bun:test";
import {
    MAX_INTERVAL_SECOND,
    PING_COUNT_MAX,
    PING_PACKET_SIZE_MAX,
    PING_PER_REQUEST_TIMEOUT_MAX,
    RESPONSE_BODY_LENGTH_MAX,
} from "@/util";

let Monitor;

beforeAll(async () => {
    await import("@/server/bun-sqlite-store");
    Monitor = (await import("@/server/model/monitor")).default;
});

const TIMEOUT_ERROR = `Timeout must be 0 or a finite number between 0.001 and ${MAX_INTERVAL_SECOND} seconds`;

function monitor(overrides = {}) {
    const bean = new Monitor();
    Object.assign(bean, {
        type: "http",
        interval: 60,
        retryInterval: 20,
        resendInterval: 0,
        maxretries: 0,
        timeout: 1,
        maxredirects: 10,
        response_max_length: 1024,
        port: null,
        ...overrides,
    });
    return bean;
}

function expectInvalid(field, values, message) {
    for (const value of values) {
        const bean = monitor({ [field]: value });
        expect(() => bean.validate(), `${field}=${String(value)}`).toThrow(message);
    }
}

describe("monitor numeric validation", () => {
    test("validate() normalizes numeric WebSocket strings before persistence", () => {
        const bean = monitor({
            interval: "60",
            retryInterval: "20",
            resendInterval: "3",
            maxretries: "2",
            timeout: "0.25",
            maxredirects: "10",
            response_max_length: "1024",
            port: "5432",
        });

        bean.validate();

        expect({
            interval: bean.interval,
            retryInterval: bean.retryInterval,
            resendInterval: bean.resendInterval,
            maxretries: bean.maxretries,
            timeout: bean.timeout,
            maxredirects: bean.maxredirects,
            response_max_length: bean.response_max_length,
            port: bean.port,
        }).toEqual({
            interval: 60,
            retryInterval: 20,
            resendInterval: 3,
            maxretries: 2,
            timeout: 0.25,
            maxredirects: 10,
            response_max_length: 1024,
            port: 5432,
        });
    });

    test("validate() preserves zero and fractional provider timeout values", () => {
        for (const value of [0, "0", "0.0", 0.001, "0.25", MAX_INTERVAL_SECOND]) {
            const bean = monitor({ timeout: value });
            bean.validate();
            expect(bean.timeout).toBe(Number(value));
        }
    });

    test("validate() rejects malformed, non-finite, negative, missing, and overflowing timeouts", () => {
        expectInvalid(
            "timeout",
            [
                "",
                "   ",
                "bogus",
                NaN,
                Infinity,
                -Infinity,
                Number.MIN_VALUE,
                0.000999,
                -0.001,
                MAX_INTERVAL_SECOND + 1,
                null,
                undefined,
                true,
                false,
                {},
                [],
            ],
            TIMEOUT_ERROR
        );
    });

    test("validate() bounds integral scheduling and retry fields", () => {
        const cases = [
            [
                "interval",
                ["", "bogus", NaN, Infinity, -Infinity, 0, -1, 1.5, MAX_INTERVAL_SECOND + 1, null, undefined],
                `Interval must be an integer between 1 and ${MAX_INTERVAL_SECOND} seconds`,
            ],
            [
                "retryInterval",
                ["", "bogus", NaN, Infinity, -Infinity, 0, -1, 1.5, MAX_INTERVAL_SECOND + 1, null, undefined],
                `Retry interval must be an integer between 1 and ${MAX_INTERVAL_SECOND} seconds`,
            ],
            [
                "maxretries",
                ["", "bogus", NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, null, undefined],
                "Retries must be a non-negative safe integer",
            ],
            [
                "resendInterval",
                ["", "bogus", NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, null, undefined],
                "Resend interval must be a non-negative safe integer",
            ],
        ];

        for (const [field, values, message] of cases) {
            expectInvalid(field, values, message);
        }
    });

    test("validate() bounds HTTP counts and persisted response length", () => {
        expectInvalid(
            "maxredirects",
            ["", "bogus", NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, null, undefined],
            "Max redirects must be a non-negative safe integer"
        );
        expectInvalid(
            "response_max_length",
            ["", "bogus", NaN, Infinity, -Infinity, -1, 0.5, RESPONSE_BODY_LENGTH_MAX + 1, null, undefined],
            `Response max length must be an integer between 0 and ${RESPONSE_BODY_LENGTH_MAX} bytes`
        );
    });

    test("validate() normalizes optional ports and rejects invalid endpoints", () => {
        for (const value of ["", "   ", null, undefined]) {
            const bean = monitor({ port: value });
            bean.validate();
            expect(bean.port).toBeNull();
        }
        for (const value of ["0", 0, "65535", 65535]) {
            const bean = monitor({ port: value });
            bean.validate();
            expect(bean.port).toBe(Number(value));
        }
        expectInvalid(
            "port",
            ["bogus", "80garbage", NaN, Infinity, -Infinity, -1, 1.5, 65536],
            "Port must be an integer between 0 and 65535"
        );
    });

    test("validate() normalizes and bounds ping scheduling fields", () => {
        const bean = monitor({
            type: "ping",
            timeout: "10.4",
            packetSize: "56",
            ping_count: "3",
            ping_per_request_timeout: "2",
        });
        bean.validate();
        expect(bean.timeout).toBe(10);
        expect(bean.packetSize).toBe(56);
        expect(bean.ping_count).toBe(3);
        expect(bean.ping_per_request_timeout).toBe(2);

        const fields = [
            [
                "packetSize",
                ["", "bogus", NaN, Infinity, -Infinity, 0, -1, 1.5, PING_PACKET_SIZE_MAX + 1, null, undefined],
                `Packet size must be an integer between 1 and ${PING_PACKET_SIZE_MAX}`,
            ],
            [
                "ping_count",
                ["", "bogus", NaN, Infinity, -Infinity, 0, -1, 1.5, PING_COUNT_MAX + 1, null, undefined],
                `Echo requests count must be an integer between 1 and ${PING_COUNT_MAX}`,
            ],
            [
                "ping_per_request_timeout",
                ["", "bogus", NaN, Infinity, -Infinity, 0, -1, 1.5, PING_PER_REQUEST_TIMEOUT_MAX + 1, null, undefined],
                `Per-ping timeout must be an integer between 1 and ${PING_PER_REQUEST_TIMEOUT_MAX} seconds`,
            ],
        ];
        for (const [field, values, message] of fields) {
            for (const value of values) {
                const invalid = monitor({
                    type: "ping",
                    timeout: 10,
                    packetSize: 56,
                    ping_count: 3,
                    ping_per_request_timeout: 2,
                    [field]: value,
                });
                expect(() => invalid.validate(), `${field}=${String(value)}`).toThrow(message);
            }
        }
    });

    test("validate() persists real-browser delay as a finite integer", () => {
        const bean = monitor({ type: "real-browser", screenshot_delay: "250" });
        bean.validate();
        expect(bean.screenshot_delay).toBe(250);

        for (const value of ["", "bogus", NaN, Infinity, -Infinity, -1, 0.5, null, undefined]) {
            const invalid = monitor({ type: "real-browser", screenshot_delay: value });
            expect(() => invalid.validate(), `screenshot_delay=${String(value)}`).toThrow(
                "Screenshot delay must be a non-negative safe integer"
            );
        }
    });

    test("normalizeRuntimeConfig() gives malformed legacy rows finite safe defaults without a database write", () => {
        const bean = monitor({
            type: "ping",
            interval: "bogus",
            retryInterval: 0,
            resendInterval: Infinity,
            maxretries: -1,
            timeout: "bogus",
            maxredirects: 0.5,
            response_max_length: "bogus",
            port: "80garbage",
            packetSize: "bogus",
            ping_count: Infinity,
            ping_per_request_timeout: 0,
        });

        bean.normalizeRuntimeConfig();

        expect({
            interval: bean.interval,
            retryInterval: bean.retryInterval,
            resendInterval: bean.resendInterval,
            maxretries: bean.maxretries,
            timeout: bean.timeout,
            maxredirects: bean.maxredirects,
            response_max_length: bean.response_max_length,
            port: bean.port,
            packetSize: bean.packetSize,
            ping_count: bean.ping_count,
            ping_per_request_timeout: bean.ping_per_request_timeout,
        }).toEqual({
            interval: 1,
            retryInterval: 1,
            resendInterval: 0,
            maxretries: 0,
            timeout: 0.8,
            maxredirects: 10,
            response_max_length: 1024,
            port: null,
            packetSize: 56,
            ping_count: 1,
            ping_per_request_timeout: 2,
        });
    });

    test("getEffectiveTimeout() preserves finite values and replaces zero, missing, malformed, and overflow values", () => {
        for (const [value, expected] of [
            ["0.25", 0.25],
            [0, 48],
            ["0", 48],
            ["", 48],
            ["bogus", 48],
            [NaN, 48],
            [Infinity, 48],
            [-1, 48],
            [MAX_INTERVAL_SECOND + 1, 48],
            [null, 48],
            [undefined, 48],
            [Number.MIN_VALUE, 48],
            [0.000999, 48],
        ]) {
            expect(monitor({ interval: 60, timeout: value }).getEffectiveTimeout(), String(value)).toBe(expected);
        }
    });
});
