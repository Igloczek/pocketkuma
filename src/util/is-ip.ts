// @ts-nocheck

const IPV4_PATTERN = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const IPV6_PATTERN =
    /^(?:(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}|(?:[a-fA-F0-9]{1,4}:){1,7}:|(?:[a-fA-F0-9]{1,4}:){1,6}:[a-fA-F0-9]{1,4}|(?:[a-fA-F0-9]{1,4}:){1,5}(?::[a-fA-F0-9]{1,4}){1,2}|(?:[a-fA-F0-9]{1,4}:){1,4}(?::[a-fA-F0-9]{1,4}){1,3}|(?:[a-fA-F0-9]{1,4}:){1,3}(?::[a-fA-F0-9]{1,4}){1,4}|(?:[a-fA-F0-9]{1,4}:){1,2}(?::[a-fA-F0-9]{1,4}){1,5}|[a-fA-F0-9]{1,4}:(?::[a-fA-F0-9]{1,4}){1,6}|:(?::[a-fA-F0-9]{1,4}){1,7}|::)$/;

/**
 * Check whether a string is an IP address (validator-compatible, no CIDR).
 * @param {string} str String to test.
 * @param {number} version IP version: 4, 6, or empty for either.
 * @returns {boolean} True when valid.
 */
function isIP(str, version) {
    if (typeof str !== "string") {
        return false;
    }

    if (str.includes("/")) {
        return false;
    }

    if (version === 4) {
        return IPV4_PATTERN.test(str);
    }

    if (version === 6) {
        return IPV6_PATTERN.test(str);
    }

    return IPV4_PATTERN.test(str) || IPV6_PATTERN.test(str);
}

export { isIP };

export default isIP;
