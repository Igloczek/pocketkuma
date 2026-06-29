// @ts-nocheck

/**
 * Returns a string that represents the javascript that is required to insert the Rybbit Analytics script
 * into a webpage.
 * @param {string} scriptUrl the Rybbit Analytics script url.
 * @param {string} siteId Site ID to use with the Rybbit Analytics script.
 * @returns {string} HTML script tags to inject into page
 */
import { escapeJsString, escapeJsJson } from "@/util/escape";
import { escapeHtml } from "@/util/escape";

function getRybbitAnalyticsScript(scriptUrl, siteId) {
    let escapedScriptUrlJS = escapeJsString(scriptUrl, { isScriptContext: true });
    let escapedSiteIdJS = escapeJsString(siteId, { isScriptContext: true });

    if (escapedScriptUrlJS) {
        escapedScriptUrlJS = escapedScriptUrlJS.trim();
    }

    if (escapedSiteIdJS) {
        escapedSiteIdJS = escapedSiteIdJS.trim();
    }

    // Escape the Script url for use in an HTML attribute.
    let escapedScriptUrlHTMLAttribute = escapeHtml(escapedScriptUrlJS);

    // Escape the site id for use in an HTML attribute.
    let escapedSiteIdHTMLAttribute = escapeHtml(escapedSiteIdJS);

    return `
        <script defer src="${escapedScriptUrlHTMLAttribute}" data-site-id="${escapedSiteIdHTMLAttribute}"></script>
    `;
}

export { getRybbitAnalyticsScript };

export default { getRybbitAnalyticsScript };
