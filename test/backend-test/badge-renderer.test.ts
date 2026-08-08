import { describe, expect, test } from "bun:test";
import { filterAndJoin, percentageToColor, renderBadge } from "@/server/badge-renderer";
import { createResponseCache } from "@/server/bun-response";
import { handleApiRequest } from "@/server/routers/api-router";
import { handleStatusPageRequest } from "@/server/routers/status-page-router";

const styles = ["plastic", "flat", "flat-square", "for-the-badge", "social"];

describe("native badge renderer", () => {
    test("renders every public style with accessible and escaped SVG", () => {
        for (const style of styles) {
            const svg = renderBadge({
                label: `Health <&"'`,
                message: "Zażółć 🚀 <script>",
                color: "informational",
                labelColor: "fff",
                style,
            });

            expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg"');
            expect(svg).toContain('role="img"');
            expect(svg).toContain("<title>");
            expect(svg).toContain("&lt;&amp;&quot;&apos;");
            expect(svg.toLowerCase()).toContain("zażółć 🚀 &lt;script&gt;");
            if (style !== "social") {
                expect(svg).toContain("#007ec6");
            }
            expect(svg).not.toContain("<script>");
        }
    });

    test("keeps the five public style geometries", () => {
        const plastic = renderBadge({ label: "build", message: "ok", style: "plastic" });
        expect(plastic).toContain('height="18"');
        expect(plastic).toContain('rx="4"');
        expect(plastic).toContain('stop-opacity=".7"');

        const flat = renderBadge({ label: "build", message: "ok", style: "flat" });
        expect(flat).toContain('height="20"');
        expect(flat).toContain('rx="3"');
        expect(flat).toContain('stop-opacity=".1"');

        const square = renderBadge({ label: "build", message: "ok", style: "flat-square" });
        expect(square).toContain('height="20"');
        expect(square).toContain('shape-rendering="crispEdges"');
        expect(square).not.toContain("linearGradient");

        const large = renderBadge({ label: "build", message: "ok", style: "for-the-badge" });
        expect(large).toContain('height="28"');
        expect(large).toContain('letter-spacing="1.25"');
        expect(large).toContain(">BUILD</text>");

        const social = renderBadge({ label: "build", message: "ok", style: "social" });
        expect(social).toContain('height="20"');
        expect(social).toContain('fill="#fcfcfc"');
        expect(social).toContain("Helvetica Neue,Helvetica,Arial");
    });

    test("validates colors and chooses readable text without a CSS parser", () => {
        expect(renderBadge({ message: "ok", color: "success" })).toContain("#4c1");
        expect(renderBadge({ message: "ok", color: "abc" })).toContain("#abc");
        expect(renderBadge({ message: "ok", color: 'url("bad")' })).toContain("#4c1");
        expect(renderBadge({ message: "ok", color: "banana" })).toContain("#4c1");
        expect(renderBadge({ message: "ok", color: "rgba(1, 2, 3, 2)" })).toContain("#4c1");
        expect(renderBadge({ message: "ok", color: "rgba(1, 2, 3, nope)" })).toContain("#4c1");
        for (const color of ["white", "rgb(255, 255, 255)", "hsl(0, 0%, 100%)"]) {
            const svg = renderBadge({ message: "ok", color });
            expect(svg).toContain(`fill="${color}"`);
            expect(svg).toContain('fill="#333"');
        }
    });

    test("bounds Unicode text by graphemes and preserves the explicit empty-label strip", () => {
        const width = (message: string) => Number(renderBadge({ message }).match(/width="(\d+)"/)?.[1]);
        expect(width("e\u0301")).toBe(width("é"));
        expect(width("👨‍👩‍👧‍👦")).toBe(width("🚀"));
        expect(width("a long ASCII status message")).toBeGreaterThan(width("Zażółć 🚀"));

        const unicode = renderBadge({ label: "Łączność", message: "rodzina 👨‍👩‍👧‍👦" });
        expect(unicode).toContain('lengthAdjust="spacingAndGlyphs"');
        expect(unicode).toContain("rodzina 👨‍👩‍👧‍👦");

        const strip = renderBadge({ label: "", message: "ok", labelColor: "red" });
        expect(strip).toContain('<rect width="10" height="20" fill="#e05d44"/>');
        expect(strip).toContain('<rect x="10"');
    });

    test("keeps width, validation, and uptime helper behavior", () => {
        expect(renderBadge({ label: "build", message: "passing", style: "for-the-badge" })).toContain("BUILD");
        expect(() => renderBadge({ message: "ok", style: "unknown" })).toThrow("Unknown badge style");

        const shortWidth = Number(renderBadge({ message: "ok" }).match(/width="(\d+)"/)?.[1]);
        const longWidth = Number(renderBadge({ message: "a much longer message" }).match(/width="(\d+)"/)?.[1]);
        expect(longWidth).toBeGreaterThan(shortWidth);

        expect(percentageToColor(0)).toBe("#c2290a");
        expect(percentageToColor(0.5)).toBe("#c2a30a");
        expect(percentageToColor(1)).toBe("#66c20a");
        expect(percentageToColor(Number.NaN)).toBe("#999");
        expect(filterAndJoin(["a", "", null, 0, "b"])).toBe("ab");
    });

    test("preserves all monitor badge routes, headers, errors, and cache", async () => {
        let latestCalls = 0;
        const context = {
            server: {},
            settings: {},
            store: {
                getRow: async () => ({ monitor_id: 1 }),
                getCell: async () => 42,
                findOne: async () => ({ info_json: JSON.stringify({ valid: true, certInfo: { daysRemaining: 20 } }) }),
            },
            heartbeatData: {
                latest: async () => {
                    latestCalls++;
                    return { status: 1, ping: 123 };
                },
                uptime: {
                    get: async () => ({ getDataByDuration: () => ({ uptime: 0.9876, avgPing: 42 }) }),
                },
            },
            responseCache: createResponseCache(),
            disableFrameSameOrigin: false,
        };
        const cases = [
            ["status", "Status", "Up"],
            ["uptime", "Uptime (24h)", "98.76%"],
            ["ping", "Avg. Ping (24h)", "42ms"],
            ["avg-response", "Avg. Response (24h)", "42ms"],
            ["cert-exp", "Cert Exp.", "20 days"],
            ["response", "Response", "123ms"],
        ];

        for (const [path, label, message] of cases) {
            const response = await handleApiRequest(new Request(`http://localhost/api/badge/1/${path}`), context);
            expect(response?.status).toBe(200);
            expect(response?.headers.get("content-type")).toBe("image/svg+xml");
            expect(response?.headers.get("access-control-allow-origin")).toBe("*");
            expect(response?.headers.get("x-frame-options")).toBe("SAMEORIGIN");
            expect(response?.headers.get("cache-control")).toBeNull();
            const body = await response!.text();
            expect(body).toContain(label);
            expect(body).toContain(message);
        }

        const statusRequest = new Request("http://localhost/api/badge/1/status");
        await handleApiRequest(statusRequest, context);
        const callsAfterFirstCachedRead = latestCalls;
        await handleApiRequest(statusRequest, context);
        expect(latestCalls).toBe(callsAfterFirstCachedRead);

        const invalid = await handleApiRequest(new Request("http://localhost/api/badge/1/status?style=unknown"), {
            ...context,
            responseCache: createResponseCache(),
        });
        expect(invalid?.status).toBe(403);
        expect(await invalid!.json()).toMatchObject({ status: "fail" });
    });

    test("preserves the status-page badge contract", async () => {
        const response = await handleStatusPageRequest(
            new Request("http://localhost/api/status-page/demo/badge?label=Site"),
            {
                server: {},
                heartbeatData: {},
                settings: {},
                store: {
                    getCell: async () => 7,
                    getCol: async () => [1, 2],
                    getAll: async (_query: string, [monitorID]: number[]) => [{ status: monitorID === 1 ? 1 : 0 }],
                },
                responseCache: createResponseCache(),
                disableFrameSameOrigin: false,
            }
        );

        expect(response?.status).toBe(200);
        expect(response?.headers.get("content-type")).toBe("image/svg+xml");
        expect(response?.headers.get("access-control-allow-origin")).toBeNull();
        expect(await response!.text()).toContain("Degraded");
    });

    test("keeps removed badge dependencies out of the Bun graph", async () => {
        const result = await Bun.build({
            entrypoints: ["src/server/routers/api-router.ts", "src/server/routers/status-page-router.ts"],
            target: "bun",
            bundle: true,
            write: false,
            metafile: true,
        });
        expect(result.success).toBe(true);
        const inputs = Object.keys(result.metafile.inputs);
        expect(inputs.some((input) => input.includes("badge-maker"))).toBe(false);
        expect(inputs.some((input) => input.includes("chroma-js"))).toBe(false);
        expect(inputs.some((input) => input.includes("anafanafo"))).toBe(false);
    });
});
