// @ts-nocheck

import { describe, test, expect } from "bun:test";
import {
    ConditionExpressionGroup,
    ConditionExpression,
    LOGICAL,
} from "../../../src/server/monitor-conditions/expression.ts";
import { evaluateExpressionGroup, evaluateExpression } from "../../../src/server/monitor-conditions/evaluator.ts";

describe("Expression Evaluator", () => {
    test("evaluateExpression() returns true when condition matches and false otherwise", () => {
        const expr = new ConditionExpression("record", "contains", "mx1.example.com");
        expect(evaluateExpression(expr, { record: "mx1.example.com" })).toBe(true);
        expect(evaluateExpression(expr, { record: "mx2.example.com" })).toBe(false);
    });

    test("evaluateExpressionGroup() with AND logic requires all conditions to be true", () => {
        const group = new ConditionExpressionGroup([
            new ConditionExpression("record", "contains", "mx1."),
            new ConditionExpression("record", "contains", "example.com", LOGICAL.AND),
        ]);
        expect(evaluateExpressionGroup(group, { record: "mx1.example.com" })).toBe(true);
        expect(evaluateExpressionGroup(group, { record: "mx1." })).toBe(false);
        expect(evaluateExpressionGroup(group, { record: "example.com" })).toBe(false);
    });

    test("evaluateExpressionGroup() with OR logic requires at least one condition to be true", () => {
        const group = new ConditionExpressionGroup([
            new ConditionExpression("record", "contains", "example.com"),
            new ConditionExpression("record", "contains", "example.org", LOGICAL.OR),
        ]);
        expect(evaluateExpressionGroup(group, { record: "example.com" })).toBe(true);
        expect(evaluateExpressionGroup(group, { record: "example.org" })).toBe(true);
        expect(evaluateExpressionGroup(group, { record: "example.net" })).toBe(false);
    });

    test("evaluateExpressionGroup() evaluates nested groups correctly", () => {
        const group = new ConditionExpressionGroup([
            new ConditionExpression("record", "contains", "mx1."),
            new ConditionExpressionGroup([
                new ConditionExpression("record", "contains", "example.com"),
                new ConditionExpression("record", "contains", "example.org", LOGICAL.OR),
            ]),
        ]);
        expect(evaluateExpressionGroup(group, { record: "mx1." })).toBe(false);
        expect(evaluateExpressionGroup(group, { record: "mx1.example.com" })).toBe(true);
        expect(evaluateExpressionGroup(group, { record: "mx1.example.org" })).toBe(true);
        expect(evaluateExpressionGroup(group, { record: "example.com" })).toBe(false);
        expect(evaluateExpressionGroup(group, { record: "example.org" })).toBe(false);
        expect(evaluateExpressionGroup(group, { record: "mx1.example.net" })).toBe(false);
    });
});
