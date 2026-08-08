import { beforeEach, describe, expect, test } from "bun:test";
import { Prometheus } from "@/server/prometheus";

const emptyStore = {
    findAll: async () => [],
    getCol: async () => [],
};

function monitor(id: number, overrides = {}) {
    return {
        id,
        name: `Monitor ${id}`,
        type: "http",
        url: `https://example.com/private/${id}?token=secret`,
        hostname: "example.com",
        port: 443,
        ...overrides,
    };
}

describe("native Prometheus metrics", () => {
    beforeEach(async () => {
        await Prometheus.init(emptyStore);
    });

    test("renders the six gauges in fixed Prometheus 0.0.4 order with safe stable labels", async () => {
        await Prometheus.init({
            findAll: async () => [
                { name: "z-tag" },
                { name: "A tag" },
                { name: "A-tag" },
                { name: "123invalid" },
                { name: "ø" },
            ],
        });
        const metrics = new Prometheus(
            monitor(7, {
                name: 'A "monitor"\nline\\name',
                url: "https://user:password@example.com:8443/private/path?token=secret#fragment",
                hostname: "host\\name",
            }),
            [
                { name: "z-tag", value: "B value" },
                { name: "A tag", value: "second" },
                { name: "A-tag", value: "first" },
                { name: "123invalid", value: "123 value" },
                { name: "ø", value: "ignored" },
            ]
        );

        metrics.update(
            { status: 1, ping: 12.5 },
            { valid: true, certInfo: { daysRemaining: 9 } },
            {
                data24h: { uptime: 0.9, avgPing: 100 },
                data30d: { uptime: 0.8, avgPing: 200 },
                data1y: { uptime: 0.7, avgPing: 300 },
            }
        );

        const result = await Prometheus.metrics(emptyStore);
        const labels =
            'Atag="first,second",invalid="value",ztag="Bvalue",monitor_id="7",monitor_name="A \\"monitor\\"\\nline\\\\name",monitor_type="http",monitor_url="https://example.com:8443",monitor_hostname="host\\\\name",monitor_port="443"';
        expect(result.contentType).toBe("text/plain; version=0.0.4; charset=utf-8");
        expect(result.body).toBe(
            [
                "# HELP monitor_cert_days_remaining The number of days remaining until the certificate expires",
                "# TYPE monitor_cert_days_remaining gauge",
                `monitor_cert_days_remaining{${labels}} 9`,
                "",
                "# HELP monitor_cert_is_valid Is the certificate still valid? (1 = Yes, 0= No)",
                "# TYPE monitor_cert_is_valid gauge",
                `monitor_cert_is_valid{${labels}} 1`,
                "",
                "# HELP monitor_uptime_ratio Uptime ratio calculated over sliding window specified by the 'window' label. (0.0 - 1.0)",
                "# TYPE monitor_uptime_ratio gauge",
                `monitor_uptime_ratio{${labels},window="1d"} 0.9`,
                `monitor_uptime_ratio{${labels},window="30d"} 0.8`,
                `monitor_uptime_ratio{${labels},window="365d"} 0.7`,
                "",
                "# HELP monitor_response_time_seconds Average response time in seconds calculated over sliding window specified by the 'window' label",
                "# TYPE monitor_response_time_seconds gauge",
                `monitor_response_time_seconds{${labels},window="1d"} 0.1`,
                `monitor_response_time_seconds{${labels},window="30d"} 0.2`,
                `monitor_response_time_seconds{${labels},window="365d"} 0.3`,
                "",
                "# HELP monitor_response_time Monitor Response Time (ms)",
                "# TYPE monitor_response_time gauge",
                `monitor_response_time{${labels}} 12.5`,
                "",
                "# HELP monitor_status Monitor Status (1 = UP, 0= DOWN, 2= PENDING, 3= MAINTENANCE)",
                "# TYPE monitor_status gauge",
                `monitor_status{${labels}} 1`,
                "",
            ].join("\n")
        );
    });

    test("updates heartbeat, TLS, and sliding windows independently and removes only its own series", async () => {
        const first = new Prometheus(monitor(1), []);
        const second = new Prometheus(monitor(2), []);

        first.update({ status: 2, ping: null }, undefined, null);
        first.update(null, { valid: true, certInfo: { daysRemaining: 14 } }, null);
        first.update(null, null, null);
        expect((await Prometheus.metrics(emptyStore)).body).toContain(
            'monitor_cert_is_valid{monitor_id="1",monitor_name="Monitor 1",monitor_type="http",monitor_url="https://example.com",monitor_hostname="example.com",monitor_port="443"} 1'
        );
        first.update(null, { valid: false, certInfo: null }, null);
        first.update(null, undefined, {
            data24h: { uptime: 0.99, avgPing: 50 },
            data30d: { uptime: 0.98, avgPing: 60 },
            data1y: { uptime: 0.97, avgPing: 70 },
        });
        second.update({ status: 1, ping: Number.NaN }, undefined, null);

        let body = (await Prometheus.metrics(emptyStore)).body;
        expect(body).toContain('monitor_cert_is_valid{monitor_id="1"');
        expect(body).toContain("} 0\n");
        expect(body).toContain('monitor_cert_days_remaining{monitor_id="1"');
        expect(body).toContain("} 14\n");
        expect(body).toContain('monitor_response_time{monitor_id="1"');
        expect(body).toContain("} -1\n");
        expect(body).toContain('monitor_response_time{monitor_id="2"');
        expect(body).toContain("} Nan\n");
        expect(body).toContain('window="1d"} 0.99');
        expect(body).toContain('window="30d"} 0.98');
        expect(body).toContain('window="365d"} 0.97');

        first.remove();
        body = (await Prometheus.metrics(emptyStore)).body;
        expect(body).not.toContain('monitor_id="1"');
        expect(body).toContain('monitor_id="2"');
        expect(body).toContain("# HELP monitor_cert_days_remaining");
    });

    test("init fixes the dynamic label schema, clears old samples, and user filtering keeps metadata", async () => {
        await Prometheus.init({ findAll: async () => [{ name: "team-name" }] });
        const first = new Prometheus(monitor(1), [
            { name: "team-name", value: "one" },
            { name: "added-later", value: "must not leak" },
        ]);
        const second = new Prometheus(monitor(2), [{ name: "team-name", value: "two" }]);
        first.update({ status: 1, ping: 1 }, undefined, null);
        second.update({ status: 0, ping: 2 }, undefined, null);

        const filtered = await Prometheus.metrics({ getCol: async () => [2] }, 99);
        expect(filtered.body).not.toContain('monitor_id="1"');
        expect(filtered.body).toContain('teamname="two",monitor_id="2"');
        expect(filtered.body).not.toContain("addedlater");
        expect(filtered.body.match(/^# HELP /gm)).toHaveLength(6);
        expect(filtered.body.match(/^# TYPE /gm)).toHaveLength(6);

        await Prometheus.init({ findAll: async () => [{ name: "replacement" }] });
        const reset = await Prometheus.metrics(emptyStore);
        expect(reset.body).not.toContain("monitor_id=");
        expect(reset.body.match(/^# HELP /gm)).toHaveLength(6);
    });

    test("renders 1000 fully populated monitors across 20 scrapes without losing series", async () => {
        await Prometheus.init({ findAll: async () => [{ name: "team" }] });
        for (let id = 1; id <= 1000; id++) {
            const exporter = new Prometheus(monitor(id), [{ name: "team", value: `team-${id % 10}` }]);
            exporter.update(
                { status: id % 4, ping: id / 10 },
                { valid: id % 2 === 0, certInfo: { daysRemaining: id % 90 } },
                {
                    data24h: { uptime: 0.99, avgPing: id / 10 },
                    data30d: { uptime: 0.98, avgPing: id / 8 },
                    data1y: { uptime: 0.97, avgPing: id / 6 },
                }
            );
        }

        let result;
        for (let scrape = 0; scrape < 20; scrape++) {
            result = await Prometheus.metrics(emptyStore);
        }
        const samples = result!.body.split("\n").filter((line) => line.startsWith("monitor_"));
        expect(samples).toHaveLength(10_000);
        expect(result!.body).toContain('monitor_status{team="team0",monitor_id="1000"');
    });

    test("sanitizes dynamic names and values, resolves collisions deterministically, and redacts URL secrets", () => {
        const instance = new Prometheus(monitor(1), []);
        expect(Prometheus.sanitizeForPrometheus("123 a-b_c")).toBe("ab_c");
        expect(Prometheus.sanitizeForPrometheus("ąę!?123")).toBe("");
        expect(Prometheus.redactMonitorURL("https://user:pass@example.com:9443/path?q=secret#token")).toBe(
            "https://example.com:9443"
        );
        expect(Prometheus.redactMonitorURL("not a URL")).toBe("");
        expect(
            instance.mapTagsToLabels([
                { name: "z-tag", value: "beta" },
                { name: "A tag", value: "second" },
                { name: "A tag", value: "Alpha" },
                { name: "A tag", value: "_first" },
                { name: "A tag", value: "alpha" },
                { name: "A-tag", value: "first" },
                { name: "A-tag", value: "" },
                { name: "alpha", value: "lower" },
                { name: "Alpha", value: "upper" },
                { name: "_zone", value: "underscore" },
            ])
        ).toEqual({
            Alpha: ["upper"],
            Atag: ["Alpha", "_first", "alpha", "first", "second"],
            _zone: ["underscore"],
            alpha: ["lower"],
            ztag: ["beta"],
        });
        expect(instance.sortTags("Alpha", "_zone")).toBeLessThan(0);
        expect(instance.sortTags("_zone", "alpha")).toBeLessThan(0);
        expect(instance.sortTags("alpha", "Alpha")).toBeGreaterThan(0);
    });
});
