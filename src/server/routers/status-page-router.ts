// @ts-nocheck
"use strict";

import StatusPage from "@/server/model/status_page";
import { badgeConstants } from "@/constants";
import { renderBadge } from "@/server/badge-renderer";
import {
    cachedResponse,
    decodePathParam,
    htmlResponse,
    httpErrorResponse,
    jsonResponse,
    queryObject,
    textResponse,
} from "@/server/bun-response";

async function statusPageHTMLResponse(store, server, slug, disableFrameSameOrigin) {
    const result = await StatusPage.renderHTMLBySlug(store, server, slug);
    return htmlResponse(result.body, {
        status: result.status,
        disableFrameSameOrigin,
    });
}

async function statusPageRSSResponse(store, server, settings, slug, request, disableFrameSameOrigin) {
    const result = await StatusPage.renderRSSBySlug(store, server, settings, slug, request);
    return textResponse(result.body, {
        status: result.status,
        type: result.contentType,
        disableFrameSameOrigin,
    });
}

async function statusPageConfigResponse(store, server, slug, disableFrameSameOrigin) {
    slug = StatusPage.normalizeSlug(slug);

    try {
        const statusPage = await store.findOne("status_page", " slug = ? ", [slug]);
        if (!statusPage) {
            return httpErrorResponse("Status Page Not Found", {
                devCors: true,
                disableFrameSameOrigin,
            });
        }

        return jsonResponse(await StatusPage.getStatusPageData(store, server, statusPage), {
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

async function statusPageHeartbeatResponse(store, heartbeatData, slug, disableFrameSameOrigin) {
    try {
        let heartbeatList = {};
        let uptimeList = {};

        slug = StatusPage.normalizeSlug(slug);
        const statusPageID = await StatusPage.slugToID(store, slug);

        const monitorIDList = await store.getCol(
            `
            SELECT monitor_group.monitor_id FROM monitor_group, \`group\`
            WHERE monitor_group.group_id = \`group\`.id
            AND public = 1
            AND \`group\`.status_page_id = ?
        `,
            [statusPageID]
        );

        for (const monitorID of monitorIDList) {
            heartbeatList[monitorID] = await heartbeatData.publicList(monitorID);
            uptimeList[`${monitorID}_24`] = (await heartbeatData.stats(monitorID)).day.uptime;
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

async function statusPageManifestResponse(store, slug, disableFrameSameOrigin) {
    slug = StatusPage.normalizeSlug(slug);

    try {
        const statusPage = await store.findOne("status_page", " slug = ? ", [slug]);
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

async function incidentHistoryResponse(store, url, slug, disableFrameSameOrigin) {
    try {
        slug = StatusPage.normalizeSlug(slug);
        const statusPageID = await StatusPage.slugToID(store, slug);

        if (!statusPageID) {
            return httpErrorResponse("Status Page Not Found", {
                devCors: true,
                disableFrameSameOrigin,
            });
        }

        const cursor = url.searchParams.get("cursor") || null;
        const result = await StatusPage.getIncidentHistory(store, statusPageID, cursor, true);
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

async function statusPageBadgeResponse(store, url, slug, disableFrameSameOrigin) {
    slug = StatusPage.normalizeSlug(slug);
    const statusPageID = await StatusPage.slugToID(store, slug);
    const {
        label,
        upColor = badgeConstants.defaultUpColor,
        downColor = badgeConstants.defaultDownColor,
        partialColor = "#F6BE00",
        maintenanceColor = "#808080",
        style = badgeConstants.defaultStyle,
    } = queryObject(url.searchParams);

    try {
        const monitorIDList = await store.getCol(
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
            const beat = await store.getAll(
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

        return textResponse(renderBadge(badgeValues), {
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

async function handleStatusPageRequest(
    request,
    { server, store, heartbeatData, settings, responseCache, disableFrameSameOrigin }
) {
    if (request.method !== "GET" && request.method !== "HEAD") {
        return null;
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const cacheKey = `status-page:${request.method}:${url.pathname}:${url.search}`;

    let match = pathname.match(/^\/status\/([^/]+)\/rss$/);
    if (match) {
        const slug = decodePathParam(match[1]);
        return cachedResponse(responseCache, cacheKey, "5 minutes", () =>
            statusPageRSSResponse(store, server, settings, slug, request, disableFrameSameOrigin)
        );
    }

    match = pathname.match(/^\/status\/([^/]+)$/);
    if (match) {
        const slug = decodePathParam(match[1]);
        return cachedResponse(responseCache, cacheKey, "5 minutes", () =>
            statusPageHTMLResponse(store, server, slug, disableFrameSameOrigin)
        );
    }

    if (pathname === "/status" || pathname === "/status-page") {
        return cachedResponse(responseCache, cacheKey, "5 minutes", () =>
            statusPageHTMLResponse(store, server, "default", disableFrameSameOrigin)
        );
    }

    match = pathname.match(/^\/api\/status-page\/heartbeat\/([^/]+)$/);
    if (match) {
        const slug = decodePathParam(match[1]);
        return cachedResponse(responseCache, cacheKey, "1 minutes", () =>
            statusPageHeartbeatResponse(store, heartbeatData, slug, disableFrameSameOrigin)
        );
    }

    match = pathname.match(/^\/api\/status-page\/([^/]+)\/manifest\.json$/);
    if (match) {
        const slug = decodePathParam(match[1]);
        return cachedResponse(responseCache, cacheKey, "1440 minutes", () =>
            statusPageManifestResponse(store, slug, disableFrameSameOrigin)
        );
    }

    match = pathname.match(/^\/api\/status-page\/([^/]+)\/incident-history$/);
    if (match) {
        const slug = decodePathParam(match[1]);
        return cachedResponse(responseCache, cacheKey, "5 minutes", () =>
            incidentHistoryResponse(store, url, slug, disableFrameSameOrigin)
        );
    }

    match = pathname.match(/^\/api\/status-page\/([^/]+)\/badge$/);
    if (match) {
        const slug = decodePathParam(match[1]);
        return cachedResponse(responseCache, cacheKey, "5 minutes", () =>
            statusPageBadgeResponse(store, url, slug, disableFrameSameOrigin)
        );
    }

    match = pathname.match(/^\/api\/status-page\/([^/]+)$/);
    if (match) {
        const slug = decodePathParam(match[1]);
        return cachedResponse(responseCache, cacheKey, "5 minutes", () =>
            statusPageConfigResponse(store, server, slug, disableFrameSameOrigin)
        );
    }

    return null;
}

export { handleStatusPageRequest };
