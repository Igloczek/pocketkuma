// @ts-nocheck
const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { BunSQLiteRedbean } = require("../../src/server/bun-sqlite-store");

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
