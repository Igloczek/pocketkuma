// @ts-nocheck

/**
 * Returns a string that represents the javascript that is required to insert the Matomo Analytics script
 * into a webpage.
 * @param {string} matomoUrl Domain name with tld to use with the Matomo Analytics script.
 * @param {string} siteId Site ID to use with the Matomo Analytics script.
 * @returns {string} HTML script tags to inject into page
 */
import { escapeJsString, escapeJsJson } from "@/util/escape";
import { escapeHtml } from "@/util/escape";

function getMatomoAnalyticsScript(matomoUrl, siteId) {
    let escapedMatomoUrlJS = escapeJsString(matomoUrl, { isScriptContext: true });
    let escapedSiteIdJS = escapeJsString(siteId, { isScriptContext: true });

    if (escapedMatomoUrlJS) {
        escapedMatomoUrlJS = escapedMatomoUrlJS.trim();
    }

    if (escapedSiteIdJS) {
        escapedSiteIdJS = escapedSiteIdJS.trim();
    }

    // Escape the domain url for use in an HTML attribute.
    let escapedMatomoUrlHTMLAttribute = escapeHtml(escapedMatomoUrlJS);

    // Escape the website id for use in an HTML attribute.
    let escapedSiteIdHTMLAttribute = escapeHtml(escapedSiteIdJS);

    return `
        <script type="text/javascript">
            var _paq = window._paq = window._paq || [];
            _paq.push(['trackPageView']);
            _paq.push(['enableLinkTracking']);
            (function() {
                var u="//${escapedMatomoUrlHTMLAttribute}/";
                _paq.push(['setTrackerUrl', u+'matomo.php']);
                _paq.push(['setSiteId', ${escapedSiteIdHTMLAttribute}]);
                var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
                g.type='text/javascript'; g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
            })();
        </script>
    `;
}

export { getMatomoAnalyticsScript };

export default { getMatomoAnalyticsScript };
