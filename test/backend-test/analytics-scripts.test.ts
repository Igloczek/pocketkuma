// @ts-nocheck

import { describe, test, expect } from "bun:test";
import analytics from "@/server/analytics/analytics";

function makeStatusPage(overrides) {
    return {
        analyticsType: null,
        analyticsId: null,
        analyticsScriptUrl: null,
        ...overrides,
    };
}

describe("Analytics scripts", () => {
    test("google analytics injects gtag script", () => {
        const script = analytics.getAnalyticsScript(
            makeStatusPage({
                analyticsType: "google",
                analyticsId: "G-TEST123",
            })
        );

        expect(script).toContain("https://www.googletagmanager.com/gtag/js?id=G-TEST123");
        expect(script).toContain("gtag('config', 'G-TEST123')");
    });

    test("umami analytics injects defer script with website id", () => {
        const scriptUrl = "https://umami.example/script.js";
        const websiteId = "website-uuid";

        const script = analytics.getAnalyticsScript(
            makeStatusPage({
                analyticsType: "umami",
                analyticsScriptUrl: scriptUrl,
                analyticsId: websiteId,
            })
        );

        expect(script).toContain(`src="${scriptUrl}"`);
        expect(script).toContain(`data-website-id="${websiteId}"`);
        expect(script).toContain("defer");
    });

    test("plausible analytics injects defer script with domain", () => {
        const scriptUrl = "https://plausible.example/script.js";
        const domains = "example.com,www.example.com";

        const script = analytics.getAnalyticsScript(
            makeStatusPage({
                analyticsType: "plausible",
                analyticsScriptUrl: scriptUrl,
                analyticsId: domains,
            })
        );

        expect(script).toContain(`src="${scriptUrl}"`);
        expect(script).toContain(`data-domain="${domains}"`);
        expect(script).toContain("defer");
    });

    test("matomo analytics injects inline tracker script", () => {
        const matomoUrl = "analytics.example.com";
        const siteId = "1";

        const script = analytics.getAnalyticsScript(
            makeStatusPage({
                analyticsType: "matomo",
                analyticsScriptUrl: matomoUrl,
                analyticsId: siteId,
            })
        );

        expect(script).toContain(`u="//${matomoUrl}/"`);
        expect(script).toContain(`['setSiteId', ${siteId}]`);
        expect(script).toContain("matomo.js");
    });

    test("rybbit analytics injects defer script with site id", () => {
        const scriptUrl = "https://rybbit.example/script.js";
        const siteId = "site-42";

        const script = analytics.getAnalyticsScript(
            makeStatusPage({
                analyticsType: "rybbit",
                analyticsScriptUrl: scriptUrl,
                analyticsId: siteId,
            })
        );

        expect(script).toContain(`src="${scriptUrl}"`);
        expect(script).toContain(`data-site-id="${siteId}"`);
        expect(script).toContain("defer");
    });

    test("isValidAnalyticsConfig requires id for google", () => {
        expect(
            analytics.isValidAnalyticsConfig(
                makeStatusPage({
                    analyticsType: "google",
                    analyticsId: "G-TEST",
                })
            )
        ).toBe(true);

        expect(
            analytics.isValidAnalyticsConfig(
                makeStatusPage({
                    analyticsType: "google",
                    analyticsId: null,
                })
            )
        ).toBe(false);
    });

    test("isValidAnalyticsConfig requires script url for non-google providers", () => {
        expect(
            analytics.isValidAnalyticsConfig(
                makeStatusPage({
                    analyticsType: "umami",
                    analyticsId: "id",
                    analyticsScriptUrl: "https://example/script.js",
                })
            )
        ).toBe(true);

        expect(
            analytics.isValidAnalyticsConfig(
                makeStatusPage({
                    analyticsType: "umami",
                    analyticsId: "id",
                    analyticsScriptUrl: null,
                })
            )
        ).toBe(false);
    });

    test("unknown analytics type returns null script and invalid config", () => {
        const statusPage = makeStatusPage({
            analyticsType: "unknown",
            analyticsId: "id",
            analyticsScriptUrl: "https://example/script.js",
        });

        expect(analytics.getAnalyticsScript(statusPage)).toBeNull();
        expect(analytics.isValidAnalyticsConfig(statusPage)).toBe(false);
    });
});