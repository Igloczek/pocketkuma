// @ts-nocheck
"use strict";

/**
 * Parse CLI arguments in a runtime-neutral way.
 * Supports --flag=value, --flag value, and boolean flags.
 * @param {string[]} argv process.argv-compatible argument array
 * @returns {Record<string, string|boolean>}
 */
function parseArgs(argv = []) {
    const args = {};
    const tokens = argv.slice(2);

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (!token || !token.startsWith("--")) {
            continue;
        }

        const arg = token.slice(2);
        const equalsIndex = arg.indexOf("=");

        if (equalsIndex !== -1) {
            const key = arg.slice(0, equalsIndex);
            args[key] = arg.slice(equalsIndex + 1);
            continue;
        }

        const nextToken = tokens[i + 1];
        if (nextToken && !nextToken.startsWith("--")) {
            args[arg] = nextToken;
            i++;
        } else {
            args[arg] = true;
        }
    }

    return args;
}

const args = typeof process !== "undefined" ? parseArgs(process.argv) : {};

export { parseArgs, args };
