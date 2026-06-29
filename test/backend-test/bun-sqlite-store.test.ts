// @ts-nocheck

import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BunSQLiteRedbean } from "../../src/server/bun-sqlite-store.ts";

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

        assert.strictEqual(monitorColumns.includes("dns_last_result"), true);
        assert.strictEqual(incidentColumns.includes("pin"), true);
        assert.strictEqual(incidentColumns.includes("active"), true);
        assert.strictEqual(statusPageColumns.includes("autoRefreshInterval"), true);
        assert.strictEqual(statusPageColumns.includes("analytics_id"), true);
        assert.strictEqual(statusPageColumns.includes("analytics_script_url"), true);
        assert.strictEqual(statusPageColumns.includes("analytics_type"), true);
        assert.strictEqual(statusPageColumns.includes("rss_title"), true);
        assert.strictEqual(statusPageColumns.includes("show_certificate_expiry"), true);
        assert.strictEqual(statusPageColumns.includes("show_only_last_heartbeat"), true);

        await store.exec(
            "INSERT INTO status_page (id, slug, title, icon, theme, autoRefreshInterval, analytics_id, analytics_script_url, analytics_type, rss_title, show_certificate_expiry, show_only_last_heartbeat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
        assert.strictEqual(incidents.length, 1);

        const statusPage = await store.findOne("status_page", " slug = ? ", ["test"]);
        assert.strictEqual(statusPage.analyticsId, "G-123");
        assert.strictEqual(statusPage.analyticsScriptUrl, "https://analytics.example/script.js");
        assert.strictEqual(statusPage.analyticsType, "google");
        assert.strictEqual(statusPage.rssTitle, "RSS");
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
        assert.strictEqual(domain, "status.example.com");
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

        assert.deepStrictEqual(heartbeat.toJSON(), {
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
        assert.strictEqual(typeof group.toPublicJSON, "function");

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
        assert.strictEqual(typeof monitor.getIgnoreTls, "function");
        assert.strictEqual(monitor.getIgnoreTls(), false);
        assert.strictEqual(monitor.sendUrl, true);
        assert.strictEqual(monitor.customUrl, "https://example.com");
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

        assert.strictEqual(columns.includes("ignoreTls"), false);
        assert.strictEqual(columns.includes("expiryNotification"), false);
        assert.strictEqual(columns.includes("domainExpiryNotification"), false);
        assert.strictEqual(columns.includes("proxyId"), false);
        assert.strictEqual(columns.includes("pushToken"), false);
        assert.strictEqual(columns.includes("responseMaxLength"), false);
        assert.strictEqual(columns.includes("retryInterval"), false);
        assert.strictEqual(columns.includes("saveResponse"), false);
        assert.strictEqual(columns.includes("wsSubprotocol"), false);
        assert.strictEqual(columns.includes("ipFamily"), false);

        const row = await store.getRow(
            "SELECT ignore_tls, expiry_notification, domain_expiry_notification, retry_interval, save_response, save_error_response, response_max_length, push_token, ws_subprotocol, ip_family FROM monitor WHERE id = ?",
            [id]
        );
        assert.strictEqual(Number(row.ignore_tls), 0);
        assert.strictEqual(Number(row.expiry_notification), 0);
        assert.strictEqual(Number(row.domain_expiry_notification), 0);
        assert.strictEqual(Number(row.retry_interval), 20);
        assert.strictEqual(Number(row.save_response), 0);
        assert.strictEqual(Number(row.save_error_response), 1);
        assert.strictEqual(Number(row.response_max_length), 1024);
        assert.strictEqual(row.push_token, "push-token");
        assert.strictEqual(row.ws_subprotocol, "chat");
        assert.strictEqual(row.ip_family, "ipv4");

        const loaded = await store.load("monitor", id);
        assert.strictEqual(loaded.getIgnoreTls(), false);
        assert.strictEqual(loaded.isEnabledExpiryNotification(), false);
        assert.strictEqual(loaded.domainExpiryNotification, false);
        assert.strictEqual(loaded.retryInterval, 20);
        assert.strictEqual(loaded.responseMaxLength, 1024);
        assert.strictEqual(loaded.pushToken, "push-token");
        assert.strictEqual(loaded.wsSubprotocol, "chat");
        assert.strictEqual(loaded.ipFamily, "ipv4");
    });

    test("prefers canonical monitor columns over legacy stray camelCase columns", async () => {
        await store.exec('ALTER TABLE monitor ADD COLUMN "ignoreTls" TEXT');
        await store.exec(
            'INSERT INTO monitor (name, type, url, interval, retry_interval, ignore_tls, "ignoreTls", accepted_statuscodes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            ["Legacy mapping", "http", "http://127.0.0.1", 60, 20, 0, "1", '["200-299"]']
        );

        const loaded = await store.findOne("monitor", " name = ? ", ["Legacy mapping"]);

        assert.strictEqual(loaded.ignore_tls, false);
        assert.strictEqual(loaded.ignoreTls, false);
        assert.strictEqual(loaded.getIgnoreTls(), false);
    });
});
