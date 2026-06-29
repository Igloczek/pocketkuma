import { gameDig4to5IdMap } from "../gamedig-v4-to-v5-map.js";
import { expectedIndexes } from "../expected-schema.js";
import type { MigrationStore } from "../store-types.js";
import { parse as parseTld } from "tldts";
import rdapDnsData from "../../../server/assets/rdap-dns.json" with { type: "json" };
import { addColumnIfMissing, columnExists, createIndexIfMissing, tableExists } from "../migration-helpers.js";

const LINE_NOTIFY_TYPE_VARIANTS = new Set([
    "linenotify",
    "line-notify",
    "line_notify",
    "line notify",
    "line",
]);

const coreIndexTables = {
    domain_expiry_domain_unique: "domain_expiry",
    fk: "monitor_group",
    good_index: "notification_sent_history",
    heartbeat_important_index: "heartbeat",
    heartbeat_monitor_id_index: "heartbeat",
    maintenance_active_index: "maintenance",
    maintenance_id_index2: "monitor_maintenance",
    maintenance_user_id: "maintenance",
    manual_active: "maintenance",
    monitor_id_index: "monitor_maintenance",
    monitor_important_time_index: "heartbeat",
    monitor_notification_index: "monitor_notification",
    monitor_remote_browser_index: "monitor",
    monitor_time_index: "heartbeat",
    notification_sent_history_type_monitor_id_days_unique: "notification_sent_history",
    proxy_user_id: "proxy",
    setting_key_unique: "setting",
    stat_daily_monitor_id_timestamp_unique: "stat_daily",
    stat_hourly_monitor_id_timestamp_unique: "stat_hourly",
    stat_minutely_monitor_id_timestamp_unique: "stat_minutely",
    status_page_cname_domain_unique: "status_page_cname",
    status_page_slug_unique: "status_page",
    user_username_unique: "user",
};

const coreIndexStatements = {
    domain_expiry_domain_unique:
        'CREATE UNIQUE INDEX IF NOT EXISTS "domain_expiry_domain_unique" ON "domain_expiry" ("domain")',
    fk: 'CREATE INDEX IF NOT EXISTS "fk" ON "monitor_group" ("monitor_id", "group_id")',
    good_index:
        'CREATE INDEX IF NOT EXISTS "good_index" ON "notification_sent_history" ("type", "monitor_id", "days")',
    heartbeat_important_index:
        'CREATE INDEX IF NOT EXISTS "heartbeat_important_index" ON "heartbeat" ("important") WHERE important = 1',
    heartbeat_monitor_id_index:
        'CREATE INDEX IF NOT EXISTS "heartbeat_monitor_id_index" ON "heartbeat" ("monitor_id")',
    maintenance_active_index: 'CREATE INDEX IF NOT EXISTS "maintenance_active_index" ON "maintenance" ("active")',
    maintenance_id_index2:
        'CREATE INDEX IF NOT EXISTS "maintenance_id_index2" ON "monitor_maintenance" ("maintenance_id")',
    maintenance_user_id: 'CREATE INDEX IF NOT EXISTS "maintenance_user_id" ON "maintenance" ("user_id")',
    manual_active: 'CREATE INDEX IF NOT EXISTS "manual_active" ON "maintenance" ("strategy", "active")',
    monitor_id_index: 'CREATE INDEX IF NOT EXISTS "monitor_id_index" ON "monitor_maintenance" ("monitor_id")',
    monitor_important_time_index:
        'CREATE INDEX IF NOT EXISTS "monitor_important_time_index" ON "heartbeat" ("monitor_id", "time") WHERE important = 1',
    monitor_notification_index:
        'CREATE INDEX IF NOT EXISTS "monitor_notification_index" ON "monitor_notification" ("monitor_id", "notification_id")',
    monitor_remote_browser_index:
        'CREATE INDEX IF NOT EXISTS "monitor_remote_browser_index" ON "monitor" ("remote_browser")',
    monitor_time_index: 'CREATE INDEX IF NOT EXISTS "monitor_time_index" ON "heartbeat" ("monitor_id", "time")',
    notification_sent_history_type_monitor_id_days_unique:
        'CREATE UNIQUE INDEX IF NOT EXISTS "notification_sent_history_type_monitor_id_days_unique" ON "notification_sent_history" ("type", "monitor_id", "days")',
    proxy_user_id: 'CREATE INDEX IF NOT EXISTS "proxy_user_id" ON "proxy" ("user_id")',
    setting_key_unique: 'CREATE UNIQUE INDEX IF NOT EXISTS "setting_key_unique" ON "setting" ("key")',
    stat_daily_monitor_id_timestamp_unique:
        'CREATE UNIQUE INDEX IF NOT EXISTS "stat_daily_monitor_id_timestamp_unique" ON "stat_daily" ("monitor_id", "timestamp")',
    stat_hourly_monitor_id_timestamp_unique:
        'CREATE UNIQUE INDEX IF NOT EXISTS "stat_hourly_monitor_id_timestamp_unique" ON "stat_hourly" ("monitor_id", "timestamp")',
    stat_minutely_monitor_id_timestamp_unique:
        'CREATE UNIQUE INDEX IF NOT EXISTS "stat_minutely_monitor_id_timestamp_unique" ON "stat_minutely" ("monitor_id", "timestamp")',
    status_page_cname_domain_unique:
        'CREATE UNIQUE INDEX IF NOT EXISTS "status_page_cname_domain_unique" ON "status_page_cname" ("domain")',
    status_page_slug_unique: 'CREATE UNIQUE INDEX IF NOT EXISTS "status_page_slug_unique" ON "status_page" ("slug")',
    user_username_unique: 'CREATE UNIQUE INDEX IF NOT EXISTS "user_username_unique" ON "user" ("username")',
};

const TYPES_WITH_DOMAIN_EXPIRY_SUPPORT_VIA_FIELD = {
    http: "url",
    keyword: "url",
    "json-query": "url",
    "real-browser": "url",
    "websocket-upgrade": "url",
    port: "hostname",
    ping: "hostname",
    "grpc-keyword": "grpc_url",
    dns: "hostname",
    smtp: "hostname",
    snmp: "hostname",
    gamedig: "hostname",
    steam: "hostname",
    mqtt: "hostname",
    radius: "hostname",
    "tailscale-ping": "hostname",
    "sip-options": "hostname",
};

const monitorColumnUpgrades = {
    accepted_statuscodes_json: 'TEXT NOT NULL DEFAULT \'["200-299"]\'',
    auth_domain: "TEXT",
    auth_method: "TEXT",
    auth_workstation: "TEXT",
    bearer_token: "TEXT",
    body: "TEXT",
    cache_bust: "BOOLEAN NOT NULL DEFAULT 0",
    conditions: "TEXT NOT NULL DEFAULT '[]'",
    database_connection_string: "TEXT",
    database_query: "TEXT",
    description: "TEXT",
    dns_last_result: "TEXT",
    dns_resolve_server: "TEXT",
    dns_resolve_type: "TEXT",
    docker_container: "TEXT",
    docker_host: "INTEGER",
    domain_expiry_notification: "BOOLEAN DEFAULT 0",
    expected_tls_alert: "TEXT",
    expected_value: "TEXT",
    expiry_notification: "BOOLEAN DEFAULT 1",
    gamedig_given_port_only: "BOOLEAN NOT NULL DEFAULT 1",
    gamedig_token: "TEXT",
    game: "TEXT",
    grpc_body: "TEXT",
    grpc_enable_tls: "BOOLEAN NOT NULL DEFAULT 0",
    grpc_metadata: "TEXT",
    grpc_method: "TEXT",
    grpc_protobuf: "TEXT",
    grpc_service_name: "TEXT",
    grpc_url: "TEXT",
    headers: "TEXT",
    http_body_encoding: "TEXT",
    ignore_tls: "BOOLEAN NOT NULL DEFAULT 0",
    invert_keyword: "BOOLEAN NOT NULL DEFAULT 0",
    ip_family: "TEXT",
    json_path: "TEXT",
    json_path_operator: "TEXT",
    kafka_producer_allow_auto_topic_creation: "BOOLEAN NOT NULL DEFAULT 0",
    kafka_producer_brokers: "TEXT",
    kafka_producer_message: "TEXT",
    kafka_producer_sasl_options: "TEXT",
    kafka_producer_ssl: "BOOLEAN NOT NULL DEFAULT 0",
    kafka_producer_topic: "TEXT",
    location: "TEXT",
    manual_status: "INTEGER",
    maxredirects: "INTEGER NOT NULL DEFAULT 10",
    method: "TEXT NOT NULL DEFAULT 'GET'",
    mqtt_check_type: "TEXT NOT NULL DEFAULT 'keyword'",
    mqtt_password: "TEXT",
    mqtt_success_message: "TEXT",
    mqtt_topic: "TEXT",
    mqtt_username: "TEXT",
    mqtt_websocket_path: "TEXT",
    oauth_audience: "TEXT",
    oauth_auth_method: "TEXT",
    oauth_client_id: "TEXT",
    oauth_client_secret: "TEXT",
    oauth_scopes: "TEXT",
    oauth_token_url: "TEXT",
    packet_size: "INTEGER NOT NULL DEFAULT 56",
    parent: "INTEGER",
    ping_count: "INTEGER NOT NULL DEFAULT 1",
    ping_numeric: "BOOLEAN NOT NULL DEFAULT 1",
    ping_per_request_timeout: "INTEGER NOT NULL DEFAULT 2",
    protocol: "TEXT",
    proxy_id: "INTEGER",
    push_token: "TEXT",
    rabbitmq_nodes: "TEXT",
    rabbitmq_password: "TEXT",
    rabbitmq_username: "TEXT",
    radius_called_station_id: "TEXT",
    radius_calling_station_id: "TEXT",
    radius_password: "TEXT",
    radius_secret: "TEXT",
    radius_username: "TEXT",
    remote_browser: "INTEGER",
    resend_interval: "INTEGER NOT NULL DEFAULT 0",
    response_max_length: "INTEGER NOT NULL DEFAULT 1024",
    retry_interval: "INTEGER NOT NULL DEFAULT 0",
    retry_only_on_status_code_failure: "BOOLEAN NOT NULL DEFAULT 0",
    save_error_response: "BOOLEAN NOT NULL DEFAULT 1",
    save_response: "BOOLEAN NOT NULL DEFAULT 0",
    screenshot_delay: "INTEGER NOT NULL DEFAULT 0",
    smtp_security: "TEXT",
    snmp_oid: "TEXT",
    snmp_v3_username: "TEXT",
    snmp_version: "TEXT DEFAULT '2c'",
    subtype: "TEXT",
    system_service_name: "TEXT",
    timeout: "REAL NOT NULL DEFAULT 0",
    tls_ca: "TEXT",
    tls_cert: "TEXT",
    tls_key: "TEXT",
    upside_down: "BOOLEAN NOT NULL DEFAULT 0",
    ws_ignore_sec_websocket_accept_header: "BOOLEAN NOT NULL DEFAULT 0",
    ws_subprotocol: "TEXT NOT NULL DEFAULT ''",
};

function getSupportedTlds() {
    const supported = new Set();
    const services = rdapDnsData["services"] ?? [];
    for (const [tlds] of services) {
        for (const tld of tlds) {
            supported.add(tld);
        }
    }
    return supported;
}

function hasRdapSupport(target, supportedTlds) {
    if (!target || typeof target !== "string") {
        return false;
    }
    const tld = parseTld(target);
    if (!tld.publicSuffix || !tld.isIcann) {
        return false;
    }
    const rootTld = tld.publicSuffix.split(".").pop();
    return supportedTlds.has(rootTld);
}

async function ensureCoreTables(store: MigrationStore) {
    const db = store.db;

    const tableStatements = [
        'CREATE TABLE IF NOT EXISTS "docker_host" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "user_id" INTEGER NOT NULL, "docker_daemon" TEXT, "docker_type" TEXT, "name" TEXT)',
        'CREATE TABLE IF NOT EXISTS "group" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL, "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "public" BOOLEAN NOT NULL DEFAULT 0, "active" BOOLEAN NOT NULL DEFAULT 1, "weight" INTEGER NOT NULL DEFAULT 1000, "status_page_id" INTEGER)',
        'CREATE TABLE IF NOT EXISTS "incident" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "title" TEXT NOT NULL, "content" TEXT NOT NULL, "style" TEXT NOT NULL DEFAULT \'warning\', "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "last_updated_date" DATETIME, "pin" BOOLEAN NOT NULL DEFAULT 1, "active" BOOLEAN NOT NULL DEFAULT 1, "status_page_id" INTEGER)',
        'CREATE TABLE IF NOT EXISTS "maintenance" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "title" TEXT NOT NULL, "description" TEXT NOT NULL, "user_id" INTEGER, "active" BOOLEAN NOT NULL DEFAULT 1, "strategy" TEXT NOT NULL DEFAULT \'single\', "start_date" DATETIME, "end_date" DATETIME, "start_time" TIME, "end_time" TIME, "weekdays" TEXT DEFAULT \'[]\', "days_of_month" TEXT DEFAULT \'[]\', "interval_day" INTEGER, "cron" TEXT, "timezone" TEXT, "duration" INTEGER, "last_start_date" DATETIME)',
        'CREATE TABLE IF NOT EXISTS "maintenance_status_page" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "status_page_id" INTEGER NOT NULL, "maintenance_id" INTEGER NOT NULL)',
        'CREATE TABLE IF NOT EXISTS "monitor_group" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "monitor_id" INTEGER NOT NULL, "group_id" INTEGER NOT NULL, "weight" INTEGER NOT NULL DEFAULT 1000, "send_url" BOOLEAN NOT NULL DEFAULT 0, "custom_url" TEXT)',
        'CREATE TABLE IF NOT EXISTS "monitor_maintenance" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "monitor_id" INTEGER NOT NULL, "maintenance_id" INTEGER NOT NULL)',
        'CREATE TABLE IF NOT EXISTS "tag" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL, "color" TEXT NOT NULL, "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
        'CREATE TABLE IF NOT EXISTS "monitor_tag" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "monitor_id" INTEGER NOT NULL, "tag_id" INTEGER NOT NULL, "value" TEXT)',
        'CREATE TABLE IF NOT EXISTS "notification_sent_history" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "type" TEXT NOT NULL, "monitor_id" INTEGER NOT NULL, "days" INTEGER NOT NULL)',
        'CREATE TABLE IF NOT EXISTS "status_page_cname" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "status_page_id" INTEGER, "domain" TEXT NOT NULL)',
        'CREATE TABLE IF NOT EXISTS "api_key" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "key" TEXT NOT NULL, "name" TEXT NOT NULL, "user_id" INTEGER NOT NULL, "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "active" BOOLEAN NOT NULL DEFAULT 1, "expires" DATETIME)',
        'CREATE TABLE IF NOT EXISTS "remote_browser" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL, "url" TEXT NOT NULL, "user_id" INTEGER)',
        'CREATE TABLE IF NOT EXISTS "monitor_tls_info" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "monitor_id" INTEGER NOT NULL, "info_json" TEXT)',
        'CREATE TABLE IF NOT EXISTS "proxy" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "user_id" INTEGER NOT NULL, "protocol" TEXT NOT NULL, "host" TEXT NOT NULL, "port" INTEGER, "auth" BOOLEAN NOT NULL, "username" TEXT, "password" TEXT, "active" BOOLEAN NOT NULL DEFAULT 1, "default" BOOLEAN NOT NULL DEFAULT 0, "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
        'CREATE TABLE IF NOT EXISTS "domain_expiry" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "last_check" DATETIME, "domain" TEXT NOT NULL, "expiry" DATETIME, "last_expiry_notification_sent" INTEGER DEFAULT NULL)',
        'CREATE TABLE IF NOT EXISTS "stat_minutely" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "monitor_id" INTEGER NOT NULL, "timestamp" INTEGER NOT NULL, "ping" REAL NOT NULL, "up" INTEGER NOT NULL, "down" INTEGER NOT NULL, "ping_min" REAL NOT NULL DEFAULT 0, "ping_max" REAL NOT NULL DEFAULT 0, "extras" TEXT DEFAULT NULL)',
        'CREATE TABLE IF NOT EXISTS "stat_hourly" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "monitor_id" INTEGER NOT NULL, "timestamp" INTEGER NOT NULL, "ping" REAL NOT NULL, "ping_min" REAL NOT NULL DEFAULT 0, "ping_max" REAL NOT NULL DEFAULT 0, "up" INTEGER NOT NULL, "down" INTEGER NOT NULL, "extras" TEXT DEFAULT NULL)',
        'CREATE TABLE IF NOT EXISTS "stat_daily" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "monitor_id" INTEGER NOT NULL, "timestamp" INTEGER NOT NULL, "ping" REAL NOT NULL, "up" INTEGER NOT NULL, "down" INTEGER NOT NULL, "ping_min" REAL NOT NULL DEFAULT 0, "ping_max" REAL NOT NULL DEFAULT 0, "extras" TEXT DEFAULT NULL)',
        'CREATE TABLE IF NOT EXISTS "status_page" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "slug" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT, "icon" TEXT NOT NULL, "theme" TEXT NOT NULL, "published" BOOLEAN NOT NULL DEFAULT 1, "search_engine_index" BOOLEAN NOT NULL DEFAULT 1, "show_tags" BOOLEAN NOT NULL DEFAULT 0, "password" TEXT, "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "modified_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "footer_text" TEXT, "custom_css" TEXT, "show_powered_by" BOOLEAN NOT NULL DEFAULT 1)',
    ];

    for (const statement of tableStatements) {
        db.run(statement);
    }
}

async function ensureMonitorColumns(store: MigrationStore) {
    const db = store.db;
    if (!tableExists(db, "monitor")) {
        return;
    }

    for (const [column, type] of Object.entries(monitorColumnUpgrades)) {
        addColumnIfMissing(db, "monitor", column, type);
    }
}

async function ensureStatusPageColumns(store: MigrationStore) {
    const db = store.db;
    if (!tableExists(db, "status_page")) {
        return;
    }

    addColumnIfMissing(db, "status_page", "analytics_id", "TEXT");
    addColumnIfMissing(db, "status_page", "analytics_script_url", "TEXT");
    addColumnIfMissing(db, "status_page", "analytics_type", "TEXT");
    addColumnIfMissing(db, "status_page", "auto_refresh_interval", "INTEGER");
    addColumnIfMissing(db, "status_page", "show_certificate_expiry", "BOOLEAN NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "status_page", "show_only_last_heartbeat", "BOOLEAN NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "status_page", "rss_title", "TEXT");

    // Legacy upstream columns are copied forward but intentionally not dropped.
    // SQLite cannot drop columns cheaply; a future table-rebuild upgrade can remove them.
    if (columnExists(db, "status_page", "google_analytics_tag_id")) {
        await store.exec(
            'UPDATE status_page SET analytics_id = google_analytics_tag_id WHERE analytics_id IS NULL AND google_analytics_tag_id IS NOT NULL'
        );
        await store.exec(
            "UPDATE status_page SET analytics_type = 'google' WHERE analytics_type IS NULL AND analytics_id IS NOT NULL"
        );
    }

    if (columnExists(db, "status_page", "autoRefreshInterval")) {
        await store.exec(
            "UPDATE status_page SET auto_refresh_interval = autoRefreshInterval WHERE auto_refresh_interval IS NULL AND autoRefreshInterval IS NOT NULL"
        );
    }

    await store.exec("UPDATE status_page SET auto_refresh_interval = 300 WHERE auto_refresh_interval IS NULL");
}

async function ensureUserColumns(store: MigrationStore) {
    const db = store.db;
    if (!tableExists(db, "user")) {
        return;
    }

    addColumnIfMissing(db, "user", "twofa_secret", "TEXT");
    addColumnIfMissing(db, "user", "twofa_status", "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "user", "twofa_last_token", "TEXT");
}

async function ensureIncidentColumns(store: MigrationStore) {
    const db = store.db;
    if (!tableExists(db, "incident")) {
        return;
    }

    addColumnIfMissing(db, "incident", "pin", "BOOLEAN NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "incident", "active", "BOOLEAN NOT NULL DEFAULT 1");
}

async function migrateGameDigIds(store: MigrationStore) {
    if (!(await store.hasTable("monitor"))) {
        return;
    }

    const monitors = await store.getAll(
        'SELECT id, game FROM monitor WHERE type = ? AND game IS NOT NULL',
        ["gamedig"]
    );

    for (const monitor of monitors) {
        const row = monitor as { id: number; game: string };
        const newGameId = gameDig4to5IdMap[row.game as keyof typeof gameDig4to5IdMap];
        if (newGameId) {
            await store.exec("UPDATE monitor SET game = ? WHERE id = ?", [newGameId, row.id]);
        }
    }
}

async function migrateSnmpJsonPathOperator(store: MigrationStore) {
    if (!(await store.hasTable("monitor"))) {
        return;
    }

    await store.exec('UPDATE monitor SET json_path_operator = ? WHERE json_path_operator IS NULL', ["=="]);
}

async function migrateStatusPageAnalytics(store: MigrationStore) {
    if (!(await store.hasTable("status_page"))) {
        return;
    }

    await store.exec(
        "UPDATE status_page SET analytics_type = 'google' WHERE analytics_type IS NULL AND analytics_id IS NOT NULL"
    );
}

function isLineNotifyNotification(config: unknown, name: unknown) {
    try {
        const parsedConfig = JSON.parse(typeof config === "string" ? config : "{}");
        const type = typeof parsedConfig.type === "string" ? parsedConfig.type.toLowerCase().trim() : "";
        if (LINE_NOTIFY_TYPE_VARIANTS.has(type)) {
            return true;
        }
        if (parsedConfig.lineNotifyAccessToken || parsedConfig.line_notify_access_token) {
            return true;
        }
    } catch {
        // Ignore invalid JSON blobs.
    }

    if (typeof name === "string" && /line\s*notify/i.test(name)) {
        return true;
    }

    return false;
}

async function removeLineNotifyNotifications(store: MigrationStore) {
    if (!(await store.hasTable("notification"))) {
        return;
    }

    const notifications = await store.getAll("SELECT id, name, config FROM notification");
    const lineNotifyIDs = [];

    for (const notification of notifications) {
        const row = notification as { id: number; name: string; config: string };
        if (isLineNotifyNotification(row.config, row.name)) {
            lineNotifyIDs.push(row.id);
        }
    }

    if (lineNotifyIDs.length === 0) {
        return;
    }

    const placeholders = lineNotifyIDs.map(() => "?").join(", ");
    if (await store.hasTable("monitor_notification")) {
        await store.exec(`DELETE FROM monitor_notification WHERE notification_id IN (${placeholders})`, lineNotifyIDs);
    }
    await store.exec(`DELETE FROM notification WHERE id IN (${placeholders})`, lineNotifyIDs);
}

async function disableUnsupportedDomainExpiryNotifications(store: MigrationStore) {
    if (!(await store.hasTable("monitor"))) {
        return;
    }

    const supportedTlds = getSupportedTlds();
    const monitors = await store.getAll(
        "SELECT id, type, url, hostname, grpc_url FROM monitor WHERE domain_expiry_notification = 1"
    );

    const idsToDisable = [];
    for (const monitor of monitors) {
        const row = monitor as {
            id: number;
            type: string;
            url: string;
            hostname: string;
            grpc_url: string;
        };
        const targetField = TYPES_WITH_DOMAIN_EXPIRY_SUPPORT_VIA_FIELD[row.type];
        if (!targetField || !hasRdapSupport(row[targetField], supportedTlds)) {
            idsToDisable.push(row.id);
        }
    }

    if (idsToDisable.length > 0) {
        const placeholders = idsToDisable.map(() => "?").join(", ");
        await store.exec(`UPDATE monitor SET domain_expiry_notification = 0 WHERE id IN (${placeholders})`, idsToDisable);
    }
}

async function ensureCoreIndexes(store: MigrationStore) {
    const db = store.db;
    for (const indexName of expectedIndexes) {
        const requiredTable = coreIndexTables[indexName];
        if (requiredTable && !tableExists(db, requiredTable)) {
            continue;
        }

        const sql = coreIndexStatements[indexName];
        if (sql) {
            createIndexIfMissing(db, sql, indexName);
        }
    }
}

export async function upgrade001BunaBaselineSchema(store: MigrationStore) {
    await ensureCoreTables(store);
    await ensureUserColumns(store);
    await ensureMonitorColumns(store);
    await ensureStatusPageColumns(store);
    await ensureIncidentColumns(store);
    await ensureCoreIndexes(store);
}

export async function upgrade001BunaBaselineData(store: MigrationStore) {
    await migrateStatusPageAnalytics(store);
    await migrateGameDigIds(store);
    await migrateSnmpJsonPathOperator(store);
    await removeLineNotifyNotifications(store);
    await disableUnsupportedDomainExpiryNotifications(store);
}

export async function upgrade001BunaBaseline(store: MigrationStore) {
    await upgrade001BunaBaselineSchema(store);
    await upgrade001BunaBaselineData(store);
}