// @ts-nocheck

import { describe, expect, test } from "bun:test";
import { assertMetricsIsolated } from "../../scripts/benchmark/auth-security-api-metrics.ts";

describe("auth metrics benchmark validator", () => {
    test("rejects URL secrets even when monitor ownership is isolated", () => {
        const ownershipA = { ownedPresent: true, foreignPresent: false };
        const ownershipB = { ownedPresent: true, foreignPresent: false };

        expect(() => assertMetricsIsolated({ ownershipA, ownershipB, secretsA: true, secretsB: false })).toThrow(
            "Metrics isolation failed"
        );
    });
});
