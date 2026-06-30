// @ts-nocheck

/**
 * Table-driven analytics script builders. Each provider returns the same HTML snippet
 * strings as the former per-provider modules.
 */
import { escapeJsString } from "@/util/escape";
import { escapeHtml } from "@/util/escape";

function trimEscaped(value) {
    if (value) {
        return value.trim();
    }
    return value;
}

function escapeScriptUrlAndId(scriptUrl, id) {
    let escapedScriptUrlJS = escapeJsString(scriptUrl, { isScriptContext: true });
    let escapedIdJS = escapeJsString(id, { isScriptContext: true });

    escapedScriptUrlJS = trimEscaped(escapedScriptUrlJS);
    escapedIdJS = trimEscaped(escapedIdJS);

    return {
        escapedScriptUrlHTMLAttribute: escapeHtml(escapedScriptUrlJS),
        escapedIdHTMLAttribute: escapeHtml(escapedIdJS),
    };
}

function buildDeferScriptTag(scriptUrl, id, dataAttribute) {
    const { escapedScriptUrlHTMLAttribute, escapedIdHTMLAttribute } = escapeScriptUrlAndId(scriptUrl, id);

    return `
        <script defer src="${escapedScriptUrlHTMLAttribute}" ${dataAttribute}="${escapedIdHTMLAttribute}"></script>
    `;
}

function buildGoogleAnalyticsScript(tagId) {
    let escapedTagIdJS = escapeJsString(tagId, { isScriptContext: true });
    escapedTagIdJS = trimEscaped(escapedTagIdJS);

    const escapedTagIdHTMLAttribute = escapeHtml(tagId);

    return `
        <script async src="https://www.googletagmanager.com/gtag/js?id=${escapedTagIdHTMLAttribute}"></script>
        <script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date());gtag('config', '${escapedTagIdJS}'); </script>
    `;
}

function buildMatomoAnalyticsScript(matomoUrl, siteId) {
    const { escapedScriptUrlHTMLAttribute: escapedMatomoUrlHTMLAttribute, escapedIdHTMLAttribute: escapedSiteIdHTMLAttribute } =
        escapeScriptUrlAndId(matomoUrl, siteId);

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

/** @type {Record<string, { requiresScriptUrl: boolean, build: (statusPage: typeof import("@/server/model/status_page").StatusPage) => string }>} */
const analyticsScripts = {
    google: {
        requiresScriptUrl: false,
        build: (statusPage) => buildGoogleAnalyticsScript(statusPage.analyticsId),
    },
    umami: {
        requiresScriptUrl: true,
        build: (statusPage) =>
            buildDeferScriptTag(statusPage.analyticsScriptUrl, statusPage.analyticsId, "data-website-id"),
    },
    plausible: {
        requiresScriptUrl: true,
        build: (statusPage) =>
            buildDeferScriptTag(statusPage.analyticsScriptUrl, statusPage.analyticsId, "data-domain"),
    },
    matomo: {
        requiresScriptUrl: true,
        build: (statusPage) => buildMatomoAnalyticsScript(statusPage.analyticsScriptUrl, statusPage.analyticsId),
    },
    rybbit: {
        requiresScriptUrl: true,
        build: (statusPage) => buildDeferScriptTag(statusPage.analyticsScriptUrl, statusPage.analyticsId, "data-site-id"),
    },
};

export { analyticsScripts, buildDeferScriptTag, buildGoogleAnalyticsScript, buildMatomoAnalyticsScript };

export default analyticsScripts;