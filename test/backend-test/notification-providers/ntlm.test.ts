// @ts-nocheck

import { describe, test, expect } from "bun:test";
import hash from "../../../src/server/modules/axios-ntlm/lib/hash.ts";

describe("createPseudoRandomValue()", () => {
    test("returns a hexadecimal string with the requested length", () => {
        for (const length of [0, 8, 16, 32, 64]) {
            const result = hash.createPseudoRandomValue(length);
            expect(typeof result).toBe("string");
            expect(result.length).toBe(length);
            expect(/^[0-9a-f]*$/.test(result)).toBeTruthy();
        }
    });

    test("returns unique values across multiple calls with the same length", () => {
        const length = 16;
        const iterations = 10;
        const results = new Set();

        for (let i = 0; i < iterations; i++) {
            results.add(hash.createPseudoRandomValue(length));
        }

        expect(results.size).toBe(iterations);
    });
});
