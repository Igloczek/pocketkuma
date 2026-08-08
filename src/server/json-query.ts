import jsonata from "jsonata";

export async function evaluateJsonata(expression: string, data: unknown) {
    return await jsonata(expression).evaluate(data);
}

export async function evaluateJsonQuery(
    data: any,
    jsonPath: string,
    jsonPathOperator: string,
    expectedValue: any
): Promise<{ status: boolean; response: any }> {
    let response: any;
    try {
        response = JSON.parse(data);
    } catch {
        response =
            (typeof data === "object" || typeof data === "number") && !Buffer.isBuffer(data) ? data : data.toString();
    }

    try {
        response = jsonPath ? await jsonata(jsonPath).evaluate(response) : response;
        if (response === null || response === undefined) {
            throw new Error("Empty or undefined response. Check query syntax and response structure");
        }

        if (Array.isArray(response)) {
            const responseStr = JSON.stringify(response);
            const truncatedResponse = responseStr.length > 25 ? responseStr.substring(0, 25) + "...]" : responseStr;
            throw new Error(
                "JSON query returned the array " +
                    truncatedResponse +
                    ", but a primitive value is required. " +
                    "Modify your query to return a single value via [0] to get the first element or use an aggregation like $count(), $sum() or $boolean()."
            );
        }

        if (typeof response === "object" || response instanceof Date || typeof response === "function") {
            throw new Error(
                `The post-JSON query evaluated response from the server is of type ${typeof response}, which cannot be directly compared to the expected value`
            );
        }

        let jsonQueryExpression;
        switch (jsonPathOperator) {
            case ">":
            case ">=":
            case "<":
            case "<=":
                jsonQueryExpression = `$number($.value) ${jsonPathOperator} $number($.expected)`;
                break;
            case "!=":
                jsonQueryExpression = "$.value != $.expected";
                break;
            case "==":
                jsonQueryExpression = "$.value = $.expected";
                break;
            case "contains":
                jsonQueryExpression = "$contains($.value, $.expected)";
                break;
            default:
                throw new Error(`Invalid condition ${jsonPathOperator}`);
        }

        const expression = jsonata(jsonQueryExpression);
        const status = await expression.evaluate({ value: response.toString(), expected: expectedValue.toString() });
        if (status === undefined) {
            throw new Error(
                "Query evaluation returned undefined. Check query syntax and the structure of the response data"
            );
        }

        return { status, response };
    } catch (err: any) {
        response = JSON.stringify(response);
        response = response && response.length > 50 ? `${response.substring(0, 100)}… (truncated)` : response;
        throw new Error(`Error evaluating JSON query: ${err.message}. Response from server was: ${response}`);
    }
}
