// @ts-nocheck

const LABEL_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
const LABEL_PATTERN_UNDERSCORE = /^[a-zA-Z0-9_](?:[a-zA-Z0-9-_]{0,61}[a-zA-Z0-9_])?$/;

/**
 * Check whether a string is a fully qualified domain name.
 * @param {string} str String to test.
 * @param {object} options Validation options.
 * @returns {boolean} True when valid.
 */
function isFQDN(str, options = {}) {
    if (typeof str !== "string" || str.length === 0) {
        return false;
    }

    let hostname = str;
    if (options.allow_trailing_dot && hostname.endsWith(".")) {
        hostname = hostname.slice(0, -1);
    }

    if (hostname.length === 0) {
        return false;
    }

    const labels = hostname.split(".");
    if (labels.length < 1) {
        return false;
    }

    const labelPattern = options.allow_underscores ? LABEL_PATTERN_UNDERSCORE : LABEL_PATTERN;

    for (const label of labels) {
        if (label.length === 0) {
            return false;
        }

        if (options.allow_wildcard && label === "*") {
            continue;
        }

        if (!labelPattern.test(label)) {
            return false;
        }
    }

    if (options.require_tld !== false && labels.length < 2) {
        return false;
    }

    return true;
}

export { isFQDN };

export default isFQDN;
