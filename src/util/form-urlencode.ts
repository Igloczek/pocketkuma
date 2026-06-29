// @ts-nocheck

/**
 * Encode flat query parameters for application/x-www-form-urlencoded bodies.
 * @param {object} params Query parameters.
 * @returns {string} Encoded form body.
 */
function formUrlencode(params) {
    const parts = [];
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) {
            continue;
        }
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
    return parts.join("&");
}

export { formUrlencode };

export default formUrlencode;
