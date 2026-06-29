// @ts-nocheck

function parseVersion(version) {
    const str = String(version);
    const prereleaseIndex = str.indexOf("-");
    const main = prereleaseIndex === -1 ? str : str.slice(0, prereleaseIndex);
    const prerelease = prereleaseIndex === -1 ? null : str.slice(prereleaseIndex + 1);

    return {
        parts: main.split(".").map((part) => Number.parseInt(part, 10) || 0),
        prerelease,
    };
}

function compareValues(a, b) {
    const left = parseVersion(a);
    const right = parseVersion(b);
    const length = Math.max(left.parts.length, right.parts.length);

    for (let i = 0; i < length; i++) {
        const leftPart = left.parts[i] || 0;
        const rightPart = right.parts[i] || 0;
        if (leftPart > rightPart) {
            return 1;
        }
        if (leftPart < rightPart) {
            return -1;
        }
    }

    if (!left.prerelease && !right.prerelease) {
        return 0;
    }

    if (!left.prerelease) {
        return 1;
    }

    if (!right.prerelease) {
        return -1;
    }

    if (left.prerelease < right.prerelease) {
        return -1;
    }

    if (left.prerelease > right.prerelease) {
        return 1;
    }

    return 0;
}

/**
 * Compare two version strings.
 * @param {string} a First version.
 * @param {string} b Second version.
 * @param {string} operator Comparison operator: >, <, =.
 * @returns {boolean} Comparison result.
 */
function compare(a, b, operator) {
    const result = compareValues(a, b);
    switch (operator) {
        case ">":
            return result > 0;
        case "<":
            return result < 0;
        case "=":
        case "==":
            return result === 0;
        default:
            throw new Error(`Unsupported comparison operator: ${operator}`);
    }
}

export { compare };

export default { compare };
