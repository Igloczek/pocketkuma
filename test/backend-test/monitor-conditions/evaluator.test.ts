// @ts-nocheck

import { describe, test } from "node:test";
import assert from "node:assert";
import {
    ConditionExpressionGroup,
    ConditionExpression,
    LOGICAL,
} from "../../../src/server/monitor-conditions/expression.ts";
import { evaluateExpressionGroup, evaluateExpression } from "../../../src/server/monitor-conditions/evaluator.ts";

describe("Expression Evaluator", () => {
    test("evaluateExpression() returns true when condition matches and false otherwise", () => {
        const expr = new ConditionExpression("record", "contains", "mx1.example.com");
        assert.strictEqual(true, evaluateExpression(expr, { record: "mx1.example.com" }));
        assert.strictEqual(false, evaluateExpression(expr, { record: "mx2.example.com" }));
    });

    test("evaluateExpressionGroup() with AND logic requires all conditions to be true", () => {
        const group = new ConditionExpressionGroup([
            new ConditionExpression("record", "contains", "mx1."),
            new ConditionExpression("record", "contains", "example.com", LOGICAL.AND),
        ]);
        assert.strictEqual(true, evaluateExpressionGroup(group, { record: "mx1.example.com" }));
        assert.strictEqual(false, evaluateExpressionGroup(group, { record: "mx1." }));
        assert.strictEqual(false, evaluateExpressionGroup(group, { record: "example.com" }));
    });

    test("evaluateExpressionGroup() with OR logic requires at least one condition to be true", () => {
        const group = new ConditionExpressionGroup([
            new ConditionExpression("record", "contains", "example.com"),
            new ConditionExpression("record", "contains", "example.org", LOGICAL.OR),
        ]);
        assert.strictEqual(true, evaluateExpressionGroup(group, { record: "example.com" }));
        assert.strictEqual(true, evaluateExpressionGroup(group, { record: "example.org" }));
        assert.strictEqual(false, evaluateExpressionGroup(group, { record: "example.net" }));
    });

    test("evaluateExpressionGroup() evaluates nested groups correctly", () => {
        const group = new ConditionExpressionGroup([
            new ConditionExpression("record", "contains", "mx1."),
            new ConditionExpressionGroup([
                new ConditionExpression("record", "contains", "example.com"),
                new ConditionExpression("record", "contains", "example.org", LOGICAL.OR),
            ]),
        ]);
        assert.strictEqual(false, evaluateExpressionGroup(group, { record: "mx1." }));
        assert.strictEqual(true, evaluateExpressionGroup(group, { record: "mx1.example.com" }));
        assert.strictEqual(true, evaluateExpressionGroup(group, { record: "mx1.example.org" }));
        assert.strictEqual(false, evaluateExpressionGroup(group, { record: "example.com" }));
        assert.strictEqual(false, evaluateExpressionGroup(group, { record: "example.org" }));
        assert.strictEqual(false, evaluateExpressionGroup(group, { record: "mx1.example.net" }));
    });
});
