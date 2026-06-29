// @ts-nocheck

import test from "node:test";
import assert from "node:assert";
import { ConditionExpressionGroup, ConditionExpression } from "../../../src/server/monitor-conditions/expression.ts";

test("Test ConditionExpressionGroup.fromMonitor", async (t) => {
    const monitor = {
        conditions: JSON.stringify([
            {
                type: "expression",
                andOr: "and",
                operator: "contains",
                value: "foo",
                variable: "record",
            },
            {
                type: "group",
                andOr: "and",
                children: [
                    {
                        type: "expression",
                        andOr: "and",
                        operator: "contains",
                        value: "bar",
                        variable: "record",
                    },
                    {
                        type: "group",
                        andOr: "and",
                        children: [
                            {
                                type: "expression",
                                andOr: "and",
                                operator: "contains",
                                value: "car",
                                variable: "record",
                            },
                        ],
                    },
                ],
            },
        ]),
    };
    const root = ConditionExpressionGroup.fromMonitor(monitor);
    assert.strictEqual(true, root.children.length === 2);
    assert.strictEqual(true, root.children[0] instanceof ConditionExpression);
    assert.strictEqual(true, root.children[0].value === "foo");
    assert.strictEqual(true, root.children[1] instanceof ConditionExpressionGroup);
    assert.strictEqual(true, root.children[1].children.length === 2);
    assert.strictEqual(true, root.children[1].children[0] instanceof ConditionExpression);
    assert.strictEqual(true, root.children[1].children[0].value === "bar");
    assert.strictEqual(true, root.children[1].children[1] instanceof ConditionExpressionGroup);
    assert.strictEqual(true, root.children[1].children[1].children.length === 1);
    assert.strictEqual(true, root.children[1].children[1].children[0] instanceof ConditionExpression);
    assert.strictEqual(true, root.children[1].children[1].children[0].value === "car");
});
