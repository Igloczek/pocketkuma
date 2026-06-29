// @ts-nocheck

const PROTOCOL_AND_DOMAIN_RE = /^(?:\w+:)?\/\/(\S+)$/;
const LOCALHOST_DOMAIN_RE = /^localhost[:?\d]*(?:[^:?\d]\S*)?$/;
const NON_LOCALHOST_DOMAIN_RE = /^[^\s.]+\.\S{2,}$/;

/**
 * Check whether a string is a valid URL (is-url package compatible).
 * @param {string} str String to test.
 * @returns {boolean} True when valid.
 */
function isUrl(str) {
    if (typeof str !== "string" || str.length === 0) {
        return false;
    }

    const match = str.match(PROTOCOL_AND_DOMAIN_RE);
    if (!match) {
        return false;
    }

    const everythingAfterProtocol = match[1];
    if (!everythingAfterProtocol) {
        return false;
    }

    return LOCALHOST_DOMAIN_RE.test(everythingAfterProtocol) || NON_LOCALHOST_DOMAIN_RE.test(everythingAfterProtocol);
}

export { isUrl };

export default isUrl;
