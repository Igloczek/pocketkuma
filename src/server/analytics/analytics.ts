// @ts-nocheck

/**
 * Returns a string that represents the javascript that is required to insert the selected Analytics' script
 * into a webpage.
 * @param {typeof import("@/server/model/status_page").StatusPage} statusPage Status page populate HTML with
 * @returns {string} HTML script tags to inject into page
 */
import analyticsScripts from "@/server/analytics/analytics-scripts";

function getAnalyticsScript(statusPage) {
    const provider = analyticsScripts[statusPage.analyticsType];
    if (!provider) {
        return null;
    }
    return provider.build(statusPage);
}

/**
 * Function that checks wether the selected analytics has been configured properly
 * @param {typeof import("@/server/model/status_page").StatusPage} statusPage Status page populate HTML with
 * @returns {boolean} Boolean defining if the analytics config is valid
 */
function isValidAnalyticsConfig(statusPage) {
    const provider = analyticsScripts[statusPage.analyticsType];
    if (!provider) {
        return false;
    }

    if (statusPage.analyticsId == null) {
        return false;
    }

    if (provider.requiresScriptUrl) {
        return statusPage.analyticsScriptUrl != null;
    }

    return true;
}

export { getAnalyticsScript, isValidAnalyticsConfig };

export default { getAnalyticsScript, isValidAnalyticsConfig };