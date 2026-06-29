// @ts-nocheck

import { describe, test, expect } from "bun:test";
import {
    operatorMap,
    OP_CONTAINS,
    OP_NOT_CONTAINS,
    OP_LT,
    OP_GT,
    OP_LTE,
    OP_GTE,
    OP_STR_EQUALS,
    OP_STR_NOT_EQUALS,
    OP_NUM_EQUALS,
    OP_NUM_NOT_EQUALS,
    OP_STARTS_WITH,
    OP_ENDS_WITH,
    OP_NOT_STARTS_WITH,
    OP_NOT_ENDS_WITH,
} from "../../../src/server/monitor-conditions/operators.ts";

describe("Expression Operators", () => {
    test("StringEqualsOperator returns true for identical strings and false otherwise", () => {
        const op = operatorMap.get(OP_STR_EQUALS);
        expect(op.test("mx1.example.com", "mx1.example.com")).toBe(true);
        expect(op.test("mx1.example.com", "mx1.example.org")).toBe(false);
        expect(op.test("1", 1)).toBe(false); // strict equality
    });

    test("StringNotEqualsOperator returns true for different strings and false for identical strings", () => {
        const op = operatorMap.get(OP_STR_NOT_EQUALS);
        expect(op.test("mx1.example.com", "mx1.example.org")).toBe(true);
        expect(op.test("mx1.example.com", "mx1.example.com")).toBe(false);
        expect(op.test(1, "1")).toBe(true); // variable is not typecasted (strict equality)
    });

    test("ContainsOperator returns true when scalar contains substring", () => {
        const op = operatorMap.get(OP_CONTAINS);
        expect(op.test("mx1.example.org", "example.org")).toBe(true);
        expect(op.test("mx1.example.org", "example.com")).toBe(false);
    });

    test("ContainsOperator returns true when array contains element", () => {
        const op = operatorMap.get(OP_CONTAINS);
        expect(op.test(["example.org"], "example.org")).toBe(true);
        expect(op.test(["example.org"], "example.com")).toBe(false);
    });

    test("NotContainsOperator returns true when scalar does not contain substring", () => {
        const op = operatorMap.get(OP_NOT_CONTAINS);
        expect(op.test("example.org", ".com")).toBe(true);
        expect(op.test("example.org", ".org")).toBe(false);
    });

    test("NotContainsOperator returns true when array does not contain element", () => {
        const op = operatorMap.get(OP_NOT_CONTAINS);
        expect(op.test(["example.org"], "example.com")).toBe(true);
        expect(op.test(["example.org"], "example.org")).toBe(false);
    });

    test("StartsWithOperator returns true when string starts with prefix", () => {
        const op = operatorMap.get(OP_STARTS_WITH);
        expect(op.test("mx1.example.com", "mx1")).toBe(true);
        expect(op.test("mx1.example.com", "mx2")).toBe(false);
    });

    test("NotStartsWithOperator returns true when string does not start with prefix", () => {
        const op = operatorMap.get(OP_NOT_STARTS_WITH);
        expect(op.test("mx1.example.com", "mx2")).toBe(true);
        expect(op.test("mx1.example.com", "mx1")).toBe(false);
    });

    test("EndsWithOperator returns true when string ends with suffix", () => {
        const op = operatorMap.get(OP_ENDS_WITH);
        expect(op.test("mx1.example.com", "example.com")).toBe(true);
        expect(op.test("mx1.example.com", "example.net")).toBe(false);
    });

    test("NotEndsWithOperator returns true when string does not end with suffix", () => {
        const op = operatorMap.get(OP_NOT_ENDS_WITH);
        expect(op.test("mx1.example.com", "example.net")).toBe(true);
        expect(op.test("mx1.example.com", "example.com")).toBe(false);
    });

    test("NumberEqualsOperator returns true for equal numbers with type coercion", () => {
        const op = operatorMap.get(OP_NUM_EQUALS);
        expect(op.test(1, 1)).toBe(true);
        expect(op.test(1, "1")).toBe(true);
        expect(op.test(1, "2")).toBe(false);
    });

    test("NumberNotEqualsOperator returns true for different numbers", () => {
        const op = operatorMap.get(OP_NUM_NOT_EQUALS);
        expect(op.test(1, "2")).toBe(true);
        expect(op.test(1, "1")).toBe(false);
    });

    test("LessThanOperator returns true when first number is less than second", () => {
        const op = operatorMap.get(OP_LT);
        expect(op.test(1, 2)).toBe(true);
        expect(op.test(1, "2")).toBe(true);
        expect(op.test(1, 1)).toBe(false);
    });

    test("GreaterThanOperator returns true when first number is greater than second", () => {
        const op = operatorMap.get(OP_GT);
        expect(op.test(2, 1)).toBe(true);
        expect(op.test(2, "1")).toBe(true);
        expect(op.test(1, 1)).toBe(false);
    });

    test("LessThanOrEqualToOperator returns true when first number is less than or equal to second", () => {
        const op = operatorMap.get(OP_LTE);
        expect(op.test(1, 1)).toBe(true);
        expect(op.test(1, 2)).toBe(true);
        expect(op.test(1, "2")).toBe(true);
        expect(op.test(1, 0)).toBe(false);
    });

    test("GreaterThanOrEqualToOperator returns true when first number is greater than or equal to second", () => {
        const op = operatorMap.get(OP_GTE);
        expect(op.test(1, 1)).toBe(true);
        expect(op.test(2, 1)).toBe(true);
        expect(op.test(2, "2")).toBe(true);
        expect(op.test(2, 3)).toBe(false);
    });
});
