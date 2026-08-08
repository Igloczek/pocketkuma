// @ts-nocheck

import { log } from "@/server/logger";

const CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";
const CORE_LABELS = ["monitor_id", "monitor_name", "monitor_type", "monitor_url", "monitor_hostname", "monitor_port"];
const WINDOWS = ["1d", "30d", "365d"];

const monitorCertDaysRemaining = new Map();
const monitorCertIsValid = new Map();
const monitorUptimeRatio = new Map();
const monitorAverageResponseTimeSeconds = new Map();
const monitorResponseTime = new Map();
const monitorStatus = new Map();

let dynamicLabels = new Set();

function setGauge(map, labels, value) {
    const key = JSON.stringify(Object.entries(labels).map(([name, labelValue]) => [name, String(labelValue)]));
    if (value === undefined) {
        map.delete(key);
        return;
    }
    if (typeof value !== "number") {
        throw new TypeError(`Value is not a valid number: ${value}`);
    }
    const renderedLabels = Object.entries(labels)
        .map(([labelName, labelValue]) => {
            const escaped = String(labelValue).replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
            return `${labelName}="${escaped}"`;
        })
        .join(",");
    map.set(key, { labels, renderedLabels, value });
}

function renderGauge(name, help, map, monitorIDs) {
    const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} gauge`];
    for (const { labels, renderedLabels, value } of map.values()) {
        if (monitorIDs && !monitorIDs.has(String(labels.monitor_id))) {
            continue;
        }
        const renderedValue = Number.isNaN(value)
            ? "Nan"
            : value === Infinity
              ? "+Inf"
              : value === -Infinity
                ? "-Inf"
                : String(value);
        lines.push(`${name}{${renderedLabels}} ${renderedValue}`);
    }
    return lines.join("\n");
}

class Prometheus {
    monitorLabelValues = {};

    /**
     * @param {object} monitor Monitor object to monitor
     * @param {Array<{name:string,value:?string}>} tags Tags to add to the monitor
     */
    constructor(monitor, tags) {
        const tagLabels = Object.entries(this.mapTagsToLabels(tags)).filter(
            ([name]) => dynamicLabels.has(name) && !CORE_LABELS.includes(name) && name !== "window"
        );
        this.monitorLabelValues = {
            ...Object.fromEntries(tagLabels),
            monitor_id: monitor.id,
            monitor_name: monitor.name,
            monitor_type: monitor.type,
            monitor_url: Prometheus.redactMonitorURL(monitor.url),
            monitor_hostname: monitor.hostname,
            monitor_port: monitor.port,
        };
    }

    /**
     * Initialize the fixed metric set and the dynamic tag label schema.
     * @param {object} store Database store
     * @returns {Promise<void>}
     */
    static async init(store) {
        dynamicLabels = new Set(
            (await store.findAll("tag"))
                .map((tag) => Prometheus.sanitizeForPrometheus(tag.name))
                .filter((name) => name && !CORE_LABELS.includes(name) && name !== "window")
                .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        );
        for (const map of [
            monitorCertDaysRemaining,
            monitorCertIsValid,
            monitorUptimeRatio,
            monitorAverageResponseTimeSeconds,
            monitorResponseTime,
            monitorStatus,
        ]) {
            map.clear();
        }
    }

    /**
     * Render the current Prometheus registry for a Bun HTTP response.
     * @param {object} store Database store
     * @param {number|null} userID Optional owner filter
     * @returns {Promise<{ body: string, contentType: string }>} Metrics body and content type
     */
    static async metrics(store, userID = null) {
        const monitorIDs =
            userID === null
                ? null
                : new Set((await store.getCol("SELECT id FROM monitor WHERE user_id = ?", [userID])).map(String));
        return {
            body:
                [
                    renderGauge(
                        "monitor_cert_days_remaining",
                        "The number of days remaining until the certificate expires",
                        monitorCertDaysRemaining,
                        monitorIDs
                    ),
                    renderGauge(
                        "monitor_cert_is_valid",
                        "Is the certificate still valid? (1 = Yes, 0= No)",
                        monitorCertIsValid,
                        monitorIDs
                    ),
                    renderGauge(
                        "monitor_uptime_ratio",
                        "Uptime ratio calculated over sliding window specified by the 'window' label. (0.0 - 1.0)",
                        monitorUptimeRatio,
                        monitorIDs
                    ),
                    renderGauge(
                        "monitor_response_time_seconds",
                        "Average response time in seconds calculated over sliding window specified by the 'window' label",
                        monitorAverageResponseTimeSeconds,
                        monitorIDs
                    ),
                    renderGauge("monitor_response_time", "Monitor Response Time (ms)", monitorResponseTime, monitorIDs),
                    renderGauge(
                        "monitor_status",
                        "Monitor Status (1 = UP, 0= DOWN, 2= PENDING, 3= MAINTENANCE)",
                        monitorStatus,
                        monitorIDs
                    ),
                ].join("\n\n") + "\n",
            contentType: CONTENT_TYPE,
        };
    }

    /**
     * Sanitize a string so it can be used as a Prometheus label name or legacy tag value.
     * @param {string} text Text to sanitize
     * @returns {string} Sanitized text
     */
    static sanitizeForPrometheus(text) {
        text = text.replace(/[^a-zA-Z0-9_]/g, "");
        return text.replace(/^[^a-zA-Z_]+/, "");
    }

    /**
     * Keep a useful URL origin without publishing credentials, paths, or query secrets.
     * @param {string} value Monitor URL
     * @returns {string} Safe URL origin or an empty value
     */
    static redactMonitorURL(value) {
        if (typeof value !== "string") {
            return "";
        }
        try {
            return new URL(value).origin;
        } catch {
            return "";
        }
    }

    /**
     * Map tag values to stable sanitized labels.
     * @param {Array<{name: string, value:?string}>} tags Tags to map
     * @returns {object} Label values ordered by sanitized name
     */
    mapTagsToLabels(tags) {
        const mappedTags = new Map();
        for (const tag of tags) {
            const name = Prometheus.sanitizeForPrometheus(tag.name);
            if (!name) {
                continue;
            }
            if (!mappedTags.has(name)) {
                mappedTags.set(name, []);
            }
            const value = Prometheus.sanitizeForPrometheus(tag.value || "");
            if (value) {
                mappedTags.get(name).push(value);
                mappedTags.get(name).sort((a, b) => this.sortTags(a, b));
            }
        }
        return Object.fromEntries([...mappedTags].sort(([a], [b]) => this.sortTags(a, b)));
    }

    /**
     * Update only the metric families represented by the supplied data.
     * @param {object|null} heartbeat Heartbeat details
     * @param {object|undefined|null} tlsInfo TLS details
     * @param {object|null} uptime Fixed-window uptime data
     * @returns {void}
     */
    update(heartbeat, tlsInfo, uptime) {
        if (tlsInfo !== undefined && tlsInfo !== null) {
            try {
                setGauge(monitorCertIsValid, this.monitorLabelValues, tlsInfo?.valid === true ? 1 : 0);
            } catch (error) {
                log.error("prometheus", "Caught error", error);
            }
            try {
                if (tlsInfo?.certInfo != null) {
                    setGauge(monitorCertDaysRemaining, this.monitorLabelValues, tlsInfo.certInfo.daysRemaining);
                }
            } catch (error) {
                log.error("prometheus", "Caught error", error);
            }
        }

        if (uptime) {
            const values = [uptime.data24h, uptime.data30d, uptime.data1y];
            for (let index = 0; index < WINDOWS.length; index++) {
                const labels = { ...this.monitorLabelValues, window: WINDOWS[index] };
                try {
                    setGauge(monitorAverageResponseTimeSeconds, labels, values[index].avgPing / 1000);
                } catch (error) {
                    log.error("prometheus", "Caught error", error);
                }
                try {
                    setGauge(monitorUptimeRatio, labels, values[index].uptime);
                } catch (error) {
                    log.error("prometheus", "Caught error", error);
                }
            }
        }

        if (heartbeat) {
            try {
                setGauge(monitorStatus, this.monitorLabelValues, heartbeat.status);
            } catch (error) {
                log.error("prometheus", "Caught error", error);
            }
            try {
                setGauge(
                    monitorResponseTime,
                    this.monitorLabelValues,
                    typeof heartbeat.ping === "number" ? heartbeat.ping : -1
                );
            } catch (error) {
                log.error("prometheus", "Caught error", error);
            }
        }
    }

    /** Remove this monitor from every metric family. */
    remove() {
        try {
            setGauge(monitorCertDaysRemaining, this.monitorLabelValues, undefined);
            setGauge(monitorCertIsValid, this.monitorLabelValues, undefined);
            for (const window of WINDOWS) {
                const labels = { ...this.monitorLabelValues, window };
                setGauge(monitorUptimeRatio, labels, undefined);
                setGauge(monitorAverageResponseTimeSeconds, labels, undefined);
            }
            setGauge(monitorResponseTime, this.monitorLabelValues, undefined);
            setGauge(monitorStatus, this.monitorLabelValues, undefined);
        } catch (error) {
            log.error("prometheus", "Caught error", error);
        }
    }

    /** Sort sanitized ASCII tag names and values without locale-dependent collation. */
    sortTags(a, b) {
        return a < b ? -1 : a > b ? 1 : 0;
    }
}

export { Prometheus };
