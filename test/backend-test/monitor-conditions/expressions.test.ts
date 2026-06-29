// @ts-nocheck

import { test, expect } from "bun:test";
import { ConditionExpressionGroup, ConditionExpression } from "../../../src/server/monitor-conditions/expression.ts";

test("Test ConditionExpressionGroup.fromMonitor", () => {
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
    expect(root.children).toHaveLength(2);
    expect(root.children[0]).toBeInstanceOf(ConditionExpression);
    expect(root.children[0].value).toBe("foo");
    expect(root.children[1]).toBeInstanceOf(ConditionExpressionGroup);
    expect(root.children[1].children).toHaveLength(2);
    expect(root.children[1].children[0]).toBeInstanceOf(ConditionExpression);
    expect(root.children[1].children[0].value).toBe("bar");
    expect(root.children[1].children[1]).toBeInstanceOf(ConditionExpressionGroup);
    expect(root.children[1].children[1].children).toHaveLength(1);
    expect(root.children[1].children[1].children[0]).toBeInstanceOf(ConditionExpression);
    expect(root.children[1].children[1].children[0].value).toBe("car");
});
