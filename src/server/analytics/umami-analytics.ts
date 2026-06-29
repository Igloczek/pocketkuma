// @ts-nocheck

/**
 * Returns a string that represents the javascript that is required to insert the Umami Analytics script
 * into a webpage.
 * @param {string} scriptUrl the Umami Analytics script url.
 * @param {string} websiteId Website ID to use with the Umami Analytics script.
 * @returns {string} HTML script tags to inject into page
 */
import { escapeJsString, escapeJsJson } from "@/util/escape";
import { escapeHtml } from "@/util/escape";

function getUmamiAnalyticsScript(scriptUrl, websiteId) {
    let escapedScriptUrlJS = escapeJsString(scriptUrl, { isScriptContext: true });
    let escapedWebsiteIdJS = escapeJsString(websiteId, { isScriptContext: true });

    if (escapedScriptUrlJS) {
        escapedScriptUrlJS = escapedScriptUrlJS.trim();
    }

    if (escapedWebsiteIdJS) {
        escapedWebsiteIdJS = escapedWebsiteIdJS.trim();
    }

    // Escape the Script url for use in an HTML attribute.
    let escapedScriptUrlHTMLAttribute = escapeHtml(escapedScriptUrlJS);

    // Escape the website id for use in an HTML attribute.
    let escapedWebsiteIdHTMLAttribute = escapeHtml(escapedWebsiteIdJS);

    return `
        <script defer src="${escapedScriptUrlHTMLAttribute}" data-website-id="${escapedWebsiteIdHTMLAttribute}"></script>
    `;
}

export { getUmamiAnalyticsScript };

export default { getUmamiAnalyticsScript };
