// @ts-nocheck
"use strict";

import StatusPage from "../model/status_page.ts";
import { R } from "../redbean-compat.ts";
import { badgeConstants } from "../../util.ts";
import { makeBadge } from "badge-maker";
import { UptimeCalculator } from "../uptime-calculator.ts";
import {
    cachedResponse,
    decodePathParam,
    htmlResponse,
    httpErrorResponse,
    jsonResponse,
    queryObject,
    textResponse,
} from "../bun-response.ts";

async function statusPageHTMLResponse(server, slug, disableFrameSameOrigin) {
    const result = await StatusPage.renderHTMLBySlug(server.indexHTML, slug);
    return htmlResponse(result.body, {
        status: result.status,
        disableFrameSameOrigin,
    });
}

async function statusPageRSSResponse(slug, request, disableFrameSameOrigin) {
    const result = await StatusPage.renderRSSBySlug(slug, request);
    return textResponse(result.body, {
        status: result.status,
        type: result.contentType,
        disableFrameSameOrigin,
    });
}

async function statusPageConfigResponse(slug, disableFrameSameOrigin) {
    slug = StatusPage.normalizeSlug(slug);

    try {
        const statusPage = await R.findOne("status_page", " slug = ? ", [slug]);
        if (!statusPage) {
            return httpErrorResponse("Status Page Not Found", {
                devCors: true,
                disableFrameSameOrigin,
            });
        }

        return jsonResponse(await StatusPage.getStatusPageData(statusPage), {
            devCors: true,
            disableFrameSameOrigin,
        });
    } catch (error) {
        return httpErrorResponse(error.message, {
            devCors: true,
            disableFrameSameOrigin,
        });
    }
}

async function statusPageHeartbeatResponse(slug, disableFrameSameOrigin) {
    try {
        let heartbeatList = {};
        let uptimeList = {};

        slug = StatusPage.normalizeSlug(slug);
        const statusPageID = await StatusPage.slugToID(slug);

        const monitorIDList = await R.getCol(
            `
            SELECT monitor_group.monitor_id FROM monitor_group, \`group\`
            WHERE monitor_group.group_id = \`group\`.id
            AND public = 1
            AND \`group\`.status_page_id = ?
        `,
            [statusPageID]
        );

        for (const monitorID of monitorIDList) {
            let list = await R.getAll(
                `
                    SELECT * FROM heartbeat
                    WHERE monitor_id = ?
                    ORDER BY time DESC
                    LIMIT 100
            `,
                [monitorID]
            );

            list = R.convertToBeans("heartbeat", list);
            heartbeatList[monitorID] = list.reverse().map((row) => row.toPublicJSON());

            const uptimeCalculator = await UptimeCalculator.getUptimeCalculator(monitorID);
            uptimeList[`${monitorID}_24`] = uptimeCalculator.get24Hour().uptime;
        }

        return jsonResponse(
            {
                heartbeatList,
                uptimeList,
            },
            {
                devCors: true,
                disableFrameSameOrigin,
            }
        );
    } catch (error) {
        return httpErrorResponse(error.message, {
            devCors: true,
            disableFrameSameOrigin,
        });
    }
}

async function statusPageManifestResponse(slug, disableFrameSameOrigin) {
    slug = StatusPage.normalizeSlug(slug);

    try {
        const statusPage = await R.findOne("status_page", " slug = ? ", [slug]);
        if (!statusPage) {
            return httpErrorResponse("Not Found", {
                devCors: true,
                disableFrameSameOrigin,
            });
        }

        return jsonResponse(
            {
                name: statusPage.title,
                start_url: "/status/" + statusPage.slug,
                display: "standalone",
                icons: [
                    {
                        src: statusPage.icon,
                        sizes: "128x128",
                        type: "image/png",
                    },
                ],
            },
            {
                devCors: true,
                disableFrameSameOrigin,
            }
        );
    } catch (error) {
        return httpErrorResponse(error.message, {
            devCors: true,
            disableFrameSameOrigin,
        });
    }
}

async function incidentHistoryResponse(url, slug, disableFrameSameOrigin) {
    try {
        slug = StatusPage.normalizeSlug(slug);
        const statusPageID = await StatusPage.slugToID(slug);

        if (!statusPageID) {
            return httpErrorResponse("Status Page Not Found", {
                devCors: true,
                disableFrameSameOrigin,
            });
        }

        const cursor = url.searchParams.get("cursor") || null;
        const result = await StatusPage.getIncidentHistory(statusPageID, cursor, true);
        return jsonResponse(
            {
                ok: true,
                ...result,
            },
            {
                devCors: true,
                disableFrameSameOrigin,
            }
        );
    } catch (error) {
        return httpErrorResponse(error.message, {
            devCors: true,
            disableFrameSameOrigin,
        });
    }
}

async function statusPageBadgeResponse(url, slug, disableFrameSameOrigin) {
    slug = StatusPage.normalizeSlug(slug);
    const statusPageID = await StatusPage.slugToID(slug);
    const {
        label,
        upColor = badgeConstants.defaultUpColor,
        downColor = badgeConstants.defaultDownColor,
        partialColor = "#F6BE00",
        maintenanceColor = "#808080",
        style = badgeConstants.defaultStyle,
    } = queryObject(url.searchParams);

    try {
        const monitorIDList = await R.getCol(
            `
            SELECT monitor_group.monitor_id FROM monitor_group, \`group\`
            WHERE monitor_group.group_id = \`group\`.id
            AND public = 1
            AND \`group\`.status_page_id = ?
        `,
            [statusPageID]
        );

        let hasUp = false;
        let hasDown = false;
        let hasMaintenance = false;

        for (const monitorID of monitorIDList) {
            const beat = await R.getAll(
                `
                    SELECT * FROM heartbeat
                    WHERE monitor_id = ?
                    ORDER BY time DESC
                    LIMIT 1
            `,
                [monitorID]
            );

            if (beat.length === 0) {
                continue;
            }

            if (beat[0].status === 3) {
                hasMaintenance = true;
            } else if (beat[0].status === 2) {
                // Pending does not affect the overall badge.
            } else if (beat[0].status === 1) {
                hasUp = true;
            } else {
                hasDown = true;
            }
        }

        const badgeValues = { style };

        if (!hasUp && !hasDown && !hasMaintenance) {
            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else if (hasMaintenance) {
            badgeValues.label = label ? label : "";
            badgeValues.color = maintenanceColor;
            badgeValues.message = "Maintenance";
        } else if (hasUp && !hasDown) {
            badgeValues.label = label ? label : "";
            badgeValues.color = upColor;
            badgeValues.message = "Up";
        } else if (hasUp && hasDown) {
            badgeValues.label = label ? label : "";
            badgeValues.color = partialColor;
            badgeValues.message = "Degraded";
        } else {
            badgeValues.label = label ? label : "";
            badgeValues.color = downColor;
            badgeValues.message = "Down";
        }

        return textResponse(makeBadge(badgeValues), {
            type: "image/svg+xml",
            devCors: true,
            disableFrameSameOrigin,
        });
    } catch (error) {
        return httpErrorResponse(error.message, {
            devCors: true,
            disableFrameSameOrigin,
        });
    }
}

async function handleStatusPageRequest(request, { server, disableFrameSameOrigin }) {
    if (request.method !== "GET" && request.method !== "HEAD") {
        return null;
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const cacheKey = `status-page:${request.method}:${url.pathname}:${url.search}`;

    let match = pathname.match(/^\/status\/([^/]+)\/rss$/);
    if (match) {
        const slug = decodePathParam(match[1]);
        return cachedResponse(cacheKey, "5 minutes", () =>
            statusPageRSSResponse(slug, request, disableFrameSameOrigin)
        );
    }

    match = pathname.match(/^\/status\/([^/]+)$/);
    if (match) {
        const slug = decodePathParam(match[1]);
        return cachedResponse(cacheKey, "5 minutes", () =>
            statusPageHTMLResponse(server, slug, disableFrameSameOrigin)
        );
    }

    if (pathname === "/status" || pathname === "/status-page") {
        return cachedResponse(cacheKey, "5 minutes", () =>
            statusPageHTMLResponse(server, "default", disableFrameSameOrigin)
        );
    }

    match = pathname.match(/^\/api\/status-page\/heartbeat\/([^/]+)$/);
    if (match) {
        const slug = decodePathParam(match[1]);
        return cachedResponse(cacheKey, "1 minutes", () => statusPageHeartbeatResponse(slug, disableFrameSameOrigin));
    }

    match = pathname.match(/^\/api\/status-page\/([^/]+)\/manifest\.json$/);
    if (match) {
        const slug = decodePathParam(match[1]);
        return cachedResponse(cacheKey, "1440 minutes", () => statusPageManifestResponse(slug, disableFrameSameOrigin));
    }

    match = pathname.match(/^\/api\/status-page\/([^/]+)\/incident-history$/);
    if (match) {
        const slug = decodePathParam(match[1]);
        return cachedResponse(cacheKey, "5 minutes", () => incidentHistoryResponse(url, slug, disableFrameSameOrigin));
    }

    match = pathname.match(/^\/api\/status-page\/([^/]+)\/badge$/);
    if (match) {
        const slug = decodePathParam(match[1]);
        return cachedResponse(cacheKey, "5 minutes", () => statusPageBadgeResponse(url, slug, disableFrameSameOrigin));
    }

    match = pathname.match(/^\/api\/status-page\/([^/]+)$/);
    if (match) {
        const slug = decodePathParam(match[1]);
        return cachedResponse(cacheKey, "5 minutes", () => statusPageConfigResponse(slug, disableFrameSameOrigin));
    }

    return null;
}

export { handleStatusPageRequest };
