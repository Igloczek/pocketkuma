// @ts-nocheck

const HTML_ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

const JS_ESCAPE_MAP = {
    "\\": "\\\\",
    "'": "\\'",
    '"': '\\"',
    "\n": "\\n",
    "\r": "\\r",
    "\t": "\\t",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029",
};

/**
 * Escape a string for safe HTML attribute/text insertion.
 * @param {string} str String to escape.
 * @returns {string} Escaped string.
 */
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

/**
 * Escape a string for JavaScript string literals.
 * @param {string} str String to escape.
 * @param {object} options Escape options.
 * @returns {string} Escaped string.
 */
function escapeJsString(str, options = {}) {
    let escaped = String(str).replace(/[\\'"\n\r\t\u2028\u2029<>\u2028\u2029]/g, (char) => JS_ESCAPE_MAP[char] || char);

    if (options.isScriptContext) {
        escaped = escaped.replace(/<\//g, "<\\/");
    }

    return escaped;
}

/**
 * Escape a JSON-serializable value for script context embedding.
 * @param {unknown} value Value to escape.
 * @param {object} options Escape options.
 * @returns {string} Escaped JSON string.
 */
function escapeJsJson(value, options = {}) {
    const serialized = JSON.stringify(value);
    let escaped = (serialized === undefined ? "null" : serialized).replace(
        /<\//g,
        options.isScriptContext ? "<\\/" : "</"
    );
    if (options.isScriptContext) {
        escaped = escaped.replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }
    return escaped;
}

export { escapeHtml, escapeJsString, escapeJsJson };
