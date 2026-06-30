// @ts-nocheck

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BunSQLiteRedbean } from "@/server/bun-sqlite-store";

describe("Bun SQLite Redbean compatibility store", () => {
    let dir;
    let store;

    beforeEach(async () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "uptime-buna-store-"));
        store = new BunSQLiteRedbean();
        await store.connect({
            sqlitePath: path.join(dir, "kuma.db"),
            templatePath: path.join(process.cwd(), "src/db/kuma.db"),
            testMode: true,
        });
    });

    afterEach(async () => {
        await store.close();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test("bootstraps status-page and incident columns used by Bun runtime queries", async () => {
        const monitorColumns = await store.getCol("SELECT name FROM pragma_table_info('monitor')");
        const incidentColumns = await store.getCol("SELECT name FROM pragma_table_info('incident')");
        const statusPageColumns = await store.getCol("SELECT name FROM pragma_table_info('status_page')");

        expect(monitorColumns.includes("dns_last_result")).toBe(true);
        expect(incidentColumns.includes("pin")).toBe(true);
        expect(incidentColumns.includes("active")).toBe(true);
        expect(statusPageColumns.includes("auto_refresh_interval")).toBe(true);
        expect(statusPageColumns.includes("analytics_id")).toBe(true);
        expect(statusPageColumns.includes("analytics_script_url")).toBe(true);
        expect(statusPageColumns.includes("analytics_type")).toBe(true);
        expect(statusPageColumns.includes("rss_title")).toBe(true);
        expect(statusPageColumns.includes("show_certificate_expiry")).toBe(true);
        expect(statusPageColumns.includes("show_only_last_heartbeat")).toBe(true);

        await store.exec(
            "INSERT INTO status_page (id, slug, title, icon, theme, auto_refresh_interval, analytics_id, analytics_script_url, analytics_type, rss_title, show_certificate_expiry, show_only_last_heartbeat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [1, "test", "Test", "", "auto", 30, "G-123", "https://analytics.example/script.js", "google", "RSS", 1, 1]
        );
        await store.exec(
            "INSERT INTO incident (title, content, style, pin, active, status_page_id, created_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ["Incident", "Content", "warning", 1, 1, 1, "2026-01-01 00:00:00"]
        );
        await store.exec("UPDATE monitor SET dns_last_result = ? WHERE id = ?", ["127.0.0.1", -1]);

        const incidents = await store.find(
            "incident",
            "pin = 1 AND active = 1 AND status_page_id = ? ORDER BY created_date DESC",
            [1]
        );
        expect(incidents.length).toBe(1);

        const statusPage = await store.findOne("status_page", " slug = ? ", ["test"]);
        expect(statusPage.analyticsId).toBe("G-123");
        expect(statusPage.analyticsScriptUrl).toBe("https://analytics.example/script.js");
        expect(statusPage.analyticsType).toBe("google");
        expect(statusPage.rssTitle).toBe("RSS");
    });

    test("transaction handle supports status-page domain mapping operations", async () => {
        await store.exec("INSERT INTO status_page (id, slug, title, icon, theme) VALUES (?, ?, ?, ?, ?)", [
            1,
            "test",
            "Test",
            "",
            "auto",
        ]);

        const trx = await store.begin();
        try {
            await trx.exec("DELETE FROM status_page_cname WHERE status_page_id = ?", [1]);
            const mapping = trx.dispense("status_page_cname");
            mapping.status_page_id = 1;
            mapping.domain = "status.example.com";
            await trx.store(mapping);
            await trx.commit();
        } catch (error) {
            await trx.rollback();
            throw error;
        }

        const domain = await store.getCell("SELECT domain FROM status_page_cname WHERE status_page_id = ?", [1]);
        expect(domain).toBe("status.example.com");
    });

    test("serializes freshly dispensed heartbeat beans for live socket events", async () => {
        const heartbeat = store.dispense("heartbeat");
        heartbeat.monitor_id = 7;
        heartbeat.status = 1;
        heartbeat.time = "2026-01-01 00:00:00.000";
        heartbeat.msg = "200 - OK";
        heartbeat.ping = 12;
        heartbeat.important = true;
        heartbeat.duration = 50;
        heartbeat.retries = 0;

        expect(heartbeat.toJSON()).toEqual({
            monitorID: 7,
            status: 1,
            time: "2026-01-01 00:00:00.000",
            msg: "200 - OK",
            ping: 12,
            important: true,
            duration: 50,
            retries: 0,
            response: undefined,
        });
    });

    test("returns model beans for status-page group relations", async () => {
        await store.exec("INSERT INTO user (id, username, password, active) VALUES (?, ?, ?, ?)", [
            1,
            "smoke",
            "hash",
            1,
        ]);
        await store.exec("INSERT INTO status_page (id, slug, title, icon, theme) VALUES (?, ?, ?, ?, ?)", [
            1,
            "test",
            "Test",
            "",
            "auto",
        ]);
        await store.exec("INSERT INTO `group` (id, name, public, status_page_id, weight) VALUES (?, ?, ?, ?, ?)", [
            1,
            "Public",
            1,
            1,
            1,
        ]);
        await store.exec(
            "INSERT INTO monitor (id, name, type, url, interval, retry_interval, accepted_statuscodes_json, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [1, "Monitor", "http", "http://127.0.0.1", 60, 20, '["200-299"]', 1]
        );
        await store.exec(
            "INSERT INTO monitor_group (monitor_id, group_id, weight, send_url, custom_url) VALUES (?, ?, ?, ?, ?)",
            [1, 1, 1, 1, "https://example.com"]
        );

        const group = await store.findOne("group", " status_page_id = ? ", [1]);
        expect(typeof group.toPublicJSON).toBe("function");

        const monitorRows = await store.getAll(
            `
            SELECT monitor.*, monitor_group.send_url, monitor_group.custom_url
            FROM monitor, monitor_group
            WHERE monitor.id = monitor_group.monitor_id
            AND group_id = ?
            ORDER BY monitor_group.weight
        `,
            [1]
        );

        const [monitor] = store.convertToBeans("monitor", monitorRows);
        expect(typeof monitor.getIgnoreTls).toBe("function");
        expect(monitor.getIgnoreTls()).toBe(false);
        expect(monitor.sendUrl).toBe(true);
        expect(monitor.customUrl).toBe("https://example.com");
    });

    test("stores monitor camelCase fields in canonical snake_case columns", async () => {
        await store.exec("INSERT INTO user (id, username, password, active) VALUES (?, ?, ?, ?)", [
            1,
            "smoke",
            "hash",
            1,
        ]);

        const bean = store.dispense("monitor");
        bean.import({
            active: true,
            accepted_statuscodes_json: '["200-299"]',
            domainExpiryNotification: false,
            expiryNotification: false,
            ignoreTls: false,
            interval: 60,
            invertKeyword: false,
            ipFamily: "ipv4",
            maxretries: 0,
            name: "Store mapping",
            proxyId: null,
            pushToken: "push-token",
            resendInterval: 0,
            responseMaxLength: 1024,
            retryInterval: 20,
            saveErrorResponse: true,
            saveResponse: false,
            type: "http",
            upsideDown: false,
            url: "http://127.0.0.1",
            user_id: 1,
            weight: 2000,
            wsSubprotocol: "chat",
        });

        const id = await store.store(bean);
        const columns = await store.getCol("SELECT name FROM pragma_table_info('monitor')");

        expect(columns.includes("ignoreTls")).toBe(false);
        expect(columns.includes("expiryNotification")).toBe(false);
        expect(columns.includes("domainExpiryNotification")).toBe(false);
        expect(columns.includes("proxyId")).toBe(false);
        expect(columns.includes("pushToken")).toBe(false);
        expect(columns.includes("responseMaxLength")).toBe(false);
        expect(columns.includes("retryInterval")).toBe(false);
        expect(columns.includes("saveResponse")).toBe(false);
        expect(columns.includes("wsSubprotocol")).toBe(false);
        expect(columns.includes("ipFamily")).toBe(false);

        const row = await store.getRow(
            "SELECT ignore_tls, expiry_notification, domain_expiry_notification, retry_interval, save_response, save_error_response, response_max_length, push_token, ws_subprotocol, ip_family FROM monitor WHERE id = ?",
            [id]
        );
        expect(Number(row.ignore_tls)).toBe(0);
        expect(Number(row.expiry_notification)).toBe(0);
        expect(Number(row.domain_expiry_notification)).toBe(0);
        expect(Number(row.retry_interval)).toBe(20);
        expect(Number(row.save_response)).toBe(0);
        expect(Number(row.save_error_response)).toBe(1);
        expect(Number(row.response_max_length)).toBe(1024);
        expect(row.push_token).toBe("push-token");
        expect(row.ws_subprotocol).toBe("chat");
        expect(row.ip_family).toBe("ipv4");

        const loaded = await store.load("monitor", id);
        expect(loaded.getIgnoreTls()).toBe(false);
        expect(loaded.isEnabledExpiryNotification()).toBe(false);
        expect(loaded.domainExpiryNotification).toBe(false);
        expect(loaded.retryInterval).toBe(20);
        expect(loaded.responseMaxLength).toBe(1024);
        expect(loaded.pushToken).toBe("push-token");
        expect(loaded.wsSubprotocol).toBe("chat");
        expect(loaded.ipFamily).toBe("ipv4");
    });

    test("prefers canonical monitor columns over legacy stray camelCase columns", async () => {
        await store.exec('ALTER TABLE monitor ADD COLUMN "ignoreTls" TEXT');
        await store.exec(
            'INSERT INTO monitor (name, type, url, interval, retry_interval, ignore_tls, "ignoreTls", accepted_statuscodes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            ["Legacy mapping", "http", "http://127.0.0.1", 60, 20, 0, "1", '["200-299"]']
        );

        const loaded = await store.findOne("monitor", " name = ? ", ["Legacy mapping"]);

        expect(loaded.ignore_tls).toBe(false);
        expect(loaded.ignoreTls).toBe(false);
        expect(loaded.getIgnoreTls()).toBe(false);
    });

    test("monitor CRUD round-trip preserves socket API field names", async () => {
        await store.exec("INSERT INTO user (id, username, password, active) VALUES (?, ?, ?, ?)", [
            1,
            "smoke",
            "hash",
            1,
        ]);

        const createPayload = {
            active: true,
            accepted_statuscodes_json: '["200-299"]',
            domainExpiryNotification: true,
            expiryNotification: false,
            ignoreTls: true,
            interval: 45,
            invertKeyword: true,
            ipFamily: "dual-stack",
            maxretries: 2,
            name: "Round-trip monitor",
            proxyId: null,
            pushToken: "round-trip-token",
            resendInterval: 30,
            responseMaxLength: 2048,
            retryInterval: 15,
            retryOnlyOnStatusCodeFailure: true,
            saveErrorResponse: false,
            saveResponse: true,
            type: "http",
            upsideDown: true,
            url: "http://127.0.0.1:8080",
            user_id: 1,
            weight: 1500,
            wsSubprotocol: "graphql-ws",
        };

        const bean = store.dispense("monitor");
        bean.import(createPayload);
        const id = await store.store(bean);

        const created = await store.load("monitor", id);
        expect(created.getIgnoreTls()).toBe(true);
        expect(created.isInvertKeyword()).toBe(true);
        expect(created.domainExpiryNotification).toBe(true);
        expect(created.isEnabledExpiryNotification()).toBe(false);
        expect(created.retryInterval).toBe(15);
        expect(created.retry_only_on_status_code_failure).toBe(true);
        expect(created.responseMaxLength).toBe(2048);
        expect(created.getSaveResponse()).toBe(true);
        expect(created.getSaveErrorResponse()).toBe(false);
        expect(created.pushToken).toBe("round-trip-token");
        expect(created.wsSubprotocol).toBe("graphql-ws");
        expect(created.ipFamily).toBe("dual-stack");
        expect(created.isUpsideDown()).toBe(true);

        created.import({
            name: "Updated round-trip monitor",
            ignoreTls: false,
            pushToken: "updated-token",
            wsSubprotocol: "json",
        });
        await store.store(created);

        const updated = await store.load("monitor", id);
        expect(updated.name).toBe("Updated round-trip monitor");
        expect(updated.getIgnoreTls()).toBe(false);
        expect(updated.pushToken).toBe("updated-token");
        expect(updated.retryInterval).toBe(15);
        expect(updated.wsSubprotocol).toBe("json");
        expect(updated.retry_only_on_status_code_failure).toBe(true);
        expect(updated.responseMaxLength).toBe(2048);
    });
});
