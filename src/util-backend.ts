/* eslint-disable camelcase */
/*!
// Backend-only utilities (Logger, jsonata, ANSI colors, etc.)
*/

import dayjs from "dayjs";
import jsonata from "jsonata";

import { intHash } from "@/util-shared";

export const isDev = process.env.NODE_ENV === "development";
export const isNode = typeof process !== "undefined" && process?.versions?.node;

// Console colors
// https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
export const CONSOLE_STYLE_Reset = "\x1b[0m";
export const CONSOLE_STYLE_Bright = "\x1b[1m";
export const CONSOLE_STYLE_Dim = "\x1b[2m";
export const CONSOLE_STYLE_Underscore = "\x1b[4m";
export const CONSOLE_STYLE_Blink = "\x1b[5m";
export const CONSOLE_STYLE_Reverse = "\x1b[7m";
export const CONSOLE_STYLE_Hidden = "\x1b[8m";

export const CONSOLE_STYLE_FgBlack = "\x1b[30m";
export const CONSOLE_STYLE_FgRed = "\x1b[31m";
export const CONSOLE_STYLE_FgGreen = "\x1b[32m";
export const CONSOLE_STYLE_FgYellow = "\x1b[33m";
export const CONSOLE_STYLE_FgBlue = "\x1b[34m";
export const CONSOLE_STYLE_FgMagenta = "\x1b[35m";
export const CONSOLE_STYLE_FgCyan = "\x1b[36m";
export const CONSOLE_STYLE_FgWhite = "\x1b[37m";
export const CONSOLE_STYLE_FgGray = "\x1b[90m";
export const CONSOLE_STYLE_FgOrange = "\x1b[38;5;208m";
export const CONSOLE_STYLE_FgLightGreen = "\x1b[38;5;119m";
export const CONSOLE_STYLE_FgLightBlue = "\x1b[38;5;117m";
export const CONSOLE_STYLE_FgViolet = "\x1b[38;5;141m";
export const CONSOLE_STYLE_FgBrown = "\x1b[38;5;130m";
export const CONSOLE_STYLE_FgPink = "\x1b[38;5;219m";

export const CONSOLE_STYLE_BgBlack = "\x1b[40m";
export const CONSOLE_STYLE_BgRed = "\x1b[41m";
export const CONSOLE_STYLE_BgGreen = "\x1b[42m";
export const CONSOLE_STYLE_BgYellow = "\x1b[43m";
export const CONSOLE_STYLE_BgBlue = "\x1b[44m";
export const CONSOLE_STYLE_BgMagenta = "\x1b[45m";
export const CONSOLE_STYLE_BgCyan = "\x1b[46m";
export const CONSOLE_STYLE_BgWhite = "\x1b[47m";
export const CONSOLE_STYLE_BgGray = "\x1b[100m";

const consoleModuleColors = [
    CONSOLE_STYLE_FgCyan,
    CONSOLE_STYLE_FgGreen,
    CONSOLE_STYLE_FgLightGreen,
    CONSOLE_STYLE_FgBlue,
    CONSOLE_STYLE_FgLightBlue,
    CONSOLE_STYLE_FgMagenta,
    CONSOLE_STYLE_FgOrange,
    CONSOLE_STYLE_FgViolet,
    CONSOLE_STYLE_FgBrown,
    CONSOLE_STYLE_FgPink,
];

type LogLevel = "info" | "warn" | "error" | "debug";

const consoleLevelColors = {
    info: CONSOLE_STYLE_FgCyan,
    warn: CONSOLE_STYLE_FgYellow,
    error: CONSOLE_STYLE_FgRed,
    debug: CONSOLE_STYLE_FgGray,
} as const;

/**
 * @deprecated Use log.debug (https://github.com/louislam/uptime-kuma/pull/910)
 * @param msg Message to write
 * @returns {void}
 */
export function debug(msg: unknown) {
    log.log("", "debug", msg);
}

class Logger {
    /**
     * UPTIME_KUMA_HIDE_LOG=debug_monitor,info_monitor
     *
     * Example:
     *  [
     *     "debug_monitor",          // Hide all logs that level is debug and the module is monitor
     *     "info_monitor",
     *  ]
     */
    hideLog: Record<string, string[]> = {
        info: [],
        warn: [],
        error: [],
        debug: [],
    };

    /**
     *
     */
    constructor() {
        if (typeof process !== "undefined" && process.env.UPTIME_KUMA_HIDE_LOG) {
            const list = process.env.UPTIME_KUMA_HIDE_LOG.split(",").map((v) => v.toLowerCase());

            for (const pair of list) {
                // split first "_" only
                const values = pair.split(/_(.*)/s);

                if (values.length >= 2) {
                    this.hideLog[values[0]].push(values[1]);
                }
            }

            this.debug("server", "UPTIME_KUMA_HIDE_LOG is set");
            this.debug("server", this.hideLog);
        }
    }

    /**
     * Write a message to the log
     * @param module The module the log comes from
     * @param level Log level. One of info, warn, error, debug.
     * @param msg Message to write
     * @returns {void}
     */
    log(module: string, level: LogLevel, ...msg: unknown[]) {
        if (level === "debug" && !isDev) {
            return;
        }

        if (this.hideLog[level] && this.hideLog[level].includes(module.toLowerCase())) {
            return;
        }

        module = module.toUpperCase();
        const levelLabel = level.toUpperCase();

        let now;
        if (dayjs.tz) {
            now = dayjs.tz(new Date()).format();
        } else {
            now = dayjs().format();
        }

        if (process.env.UPTIME_KUMA_LOG_FORMAT === "json") {
            const msgString = msg
                .map((m) => {
                    if (typeof m === "string") {
                        return m;
                    } else {
                        try {
                            return JSON.stringify(m);
                        } catch {
                            return String(m);
                        }
                    }
                })
                .join(" ");

            console.log(
                JSON.stringify({
                    time: now,
                    module: module,
                    level: level,
                    msg: msgString,
                })
            );
            return;
        }

        const levelColor = consoleLevelColors[level];
        const moduleColor = consoleModuleColors[intHash(module, consoleModuleColors.length)];

        let timePart: string;
        let modulePart: string;
        let levelPart: string;

        if (isNode) {
            // Add console colors
            switch (level) {
                case "debug":
                    timePart = CONSOLE_STYLE_FgGray + now + CONSOLE_STYLE_Reset;
                    break;
                default:
                    timePart = CONSOLE_STYLE_FgCyan + now + CONSOLE_STYLE_Reset;
                    break;
            }

            modulePart = "[" + moduleColor + module + CONSOLE_STYLE_Reset + "]";
            levelPart = levelColor + `${levelLabel}:` + CONSOLE_STYLE_Reset;
        } else {
            // No console colors
            timePart = now;
            modulePart = `[${module}]`;
            levelPart = `${levelLabel}:`;
        }

        // Write to console
        switch (level) {
            case "error":
                console.error(timePart, modulePart, levelPart, ...msg);
                break;
            case "warn":
                console.warn(timePart, modulePart, levelPart, ...msg);
                break;
            case "info":
                console.info(timePart, modulePart, levelPart, ...msg);
                break;
            case "debug":
                if (isDev) {
                    console.debug(timePart, modulePart, levelPart, ...msg);
                }
                break;
            default:
                console.log(timePart, modulePart, levelPart, ...msg);
                break;
        }
    }

    /**
     * Log an INFO message
     * @param module Module log comes from
     * @param msg Message to write
     * @returns {void}
     */
    info(module: string, ...msg: unknown[]) {
        this.log(module, "info", ...msg);
    }

    /**
     * Log a WARN message
     * @param module Module log comes from
     * @param msg Message to write
     * @returns {void}
     */
    warn(module: string, ...msg: unknown[]) {
        this.log(module, "warn", ...msg);
    }

    /**
     * Log an ERROR message
     * @param module Module log comes from
     * @param msg Message to write
     * @returns {void}
     */
    error(module: string, ...msg: unknown[]) {
        this.log(module, "error", ...msg);
    }

    /**
     * Log a DEBUG message
     * @param module Module log comes from
     * @param msg Message to write
     * @returns {void}
     */
    debug(module: string, ...msg: unknown[]) {
        this.log(module, "debug", ...msg);
    }

    /**
     * Log an exception as an ERROR
     * @param module Module log comes from
     * @param exception The exception to include
     * @param msg The message to write
     * @returns {void}
     */
    exception(module: string, exception: unknown, ...msg: unknown[]) {
        this.log(module, "error", ...msg, exception);
    }
}

export const log = new Logger();

declare global {
    interface String {
        replaceAll(str: string, newStr: string): string;
    }
}

/**
 * String.prototype.replaceAll() polyfill
 * https://gomakethings.com/how-to-replace-a-section-of-a-string-with-another-one-with-vanilla-js/
 * @author Chris Ferdinandi
 * @license MIT
 * @returns {void}
 */
export function polyfill() {
    if (!String.prototype.replaceAll) {
        (String.prototype as any).replaceAll = function (str: string, newStr: string) {
            // If a regex pattern
            if (Object.prototype.toString.call(str).toLowerCase() === "[object regexp]") {
                return this.replace(str, newStr);
            }

            // If a string
            return this.replace(new RegExp(str, "g"), newStr);
        };
    }
}

export class TimeLogger {
    startTime: number;

    /**
     *
     */
    constructor() {
        this.startTime = dayjs().valueOf();
    }

    /**
     * Output time since start of monitor
     * @param name Name of monitor
     * @returns {void}
     */
    print(name: string): void {
        if (isDev && process.env.TIMELOGGER === "1") {
            console.log(name + ": " + (dayjs().valueOf() - this.startTime) + "ms");
        }
    }
}

/**
 * Evaluate a JSON query expression against the provided data.
 * @param data The data to evaluate the JSON query against.
 * @param jsonPath The JSON path or custom JSON query expression.
 * @param jsonPathOperator The operator to use for comparison.
 * @param expectedValue The expected value to compare against.
 * @returns An object containing the status and the evaluation result.
 * @throws Error if the evaluation returns undefined.
 */
export async function evaluateJsonQuery(
    data: any,
    jsonPath: string,
    jsonPathOperator: string,
    expectedValue: any
): Promise<{ status: boolean; response: any }> {
    // Attempt to parse data as JSON; if unsuccessful, handle based on data type.
    let response: any;
    try {
        response = JSON.parse(data);
    } catch {
        response =
            (typeof data === "object" || typeof data === "number") && !Buffer.isBuffer(data) ? data : data.toString();
    }

    try {
        // If a JSON path is provided, pre-evaluate the data using it.
        response = jsonPath ? await jsonata(jsonPath).evaluate(response) : response;

        if (response === null || response === undefined) {
            throw new Error("Empty or undefined response. Check query syntax and response structure");
        }

        // Check for arrays: JSONata filter expressions like .[predicate] always return arrays
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

        // Perform the comparison logic using the chosen operator
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

        // Evaluate the JSON Query Expression
        const expression = jsonata(jsonQueryExpression);
        const status = await expression.evaluate({
            value: response.toString(),
            expected: expectedValue.toString(),
        });

        if (status === undefined) {
            throw new Error(
                "Query evaluation returned undefined. Check query syntax and the structure of the response data"
            );
        }

        return {
            status, // The evaluation of the json query
            response, // The response from the server or result from initial json-query evaluation
        };
    } catch (err: any) {
        response = JSON.stringify(response); // Ensure the response is treated as a string for the console
        response = response && response.length > 50 ? `${response.substring(0, 100)}… (truncated)` : response; // Truncate long responses to the console
        throw new Error(`Error evaluating JSON query: ${err.message}. Response from server was: ${response}`);
    }
}