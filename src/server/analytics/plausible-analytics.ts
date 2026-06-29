// @ts-nocheck

/**
 * Returns a string that represents the javascript that is required to insert the Plausible Analytics script
 * into a webpage.
 * @param {string} scriptUrl the Plausible Analytics script url.
 * @param {string} domainsToMonitor Domains to track separated by a ',' to add Plausible Analytics script.
 * @returns {string} HTML script tags to inject into page
 */
import { escapeJsString, escapeJsJson } from "@/util/escape";
import { escapeHtml } from "@/util/escape";

function getPlausibleAnalyticsScript(scriptUrl, domainsToMonitor) {
    let escapedScriptUrlJS = escapeJsString(scriptUrl, { isScriptContext: true });
    let escapedWebsiteIdJS = escapeJsString(domainsToMonitor, { isScriptContext: true });

    if (escapedScriptUrlJS) {
        escapedScriptUrlJS = escapedScriptUrlJS.trim();
    }

    if (escapedWebsiteIdJS) {
        escapedWebsiteIdJS = escapedWebsiteIdJS.trim();
    }

    // Escape the domain url for use in an HTML attribute.
    let escapedScriptUrlHTMLAttribute = escapeHtml(escapedScriptUrlJS);

    // Escape the website id for use in an HTML attribute.
    let escapedWebsiteIdHTMLAttribute = escapeHtml(escapedWebsiteIdJS);

    return `
        <script defer src="${escapedScriptUrlHTMLAttribute}" data-domain="${escapedWebsiteIdHTMLAttribute}"></script>
    `;
}

export { getPlausibleAnalyticsScript };

export default { getPlausibleAnalyticsScript };
