// @ts-nocheck
"use strict";

import { createRequire } from "node:module";
import fs from "fs";
import { Database as BunDatabase } from "bun:sqlite";
import dayjs from "dayjs";

// Bun-only hybrid: lazy require() avoids top-level model imports that would create
// circular dependencies with redbean-compat. Node CJS/ESM resolution does not support
// require("./model/*.ts") the same way; this store is only used under Bun.
const require = createRequire(import.meta.url);

class BeanModel {
    import(data) {
        if (!data || typeof data !== "object") {
            return this;
        }

        for (const [key, value] of Object.entries(data)) {
            if (typeof value !== "function") {
                this[key] = value;
            }
        }
        return this;
    }

    export() {
        const result = {};
        for (const [key, value] of Object.entries(this)) {
            if (!key.startsWith("__") && typeof value !== "function") {
                result[key] = value;
            }
        }
        return result;
    }

    toJSON() {
        return this.export();
    }
}

function loadModel(modulePath) {
    const module = require(modulePath);
    return module.default ?? module;
}

// Tables with model classes that expose instance methods (e.g. getExpiryDate) must be listed here.
// All other tables fall back to plain BeanModel in beanForTable().
const modelMap = {
    group: () => loadModel("./model/group.ts"),
    heartbeat: () => loadModel("./model/heartbeat.ts"),
    incident: () => loadModel("./model/incident.ts"),
    monitor: () => loadModel("./model/monitor.ts"),
    status_page: () => loadModel("./model/status_page.ts"),
    user: () => loadModel("./model/user.ts"),
    domain_expiry: () => loadModel("./model/domain_expiry.ts"),
};

const monitorPropertyColumns = {
    authDomain: "auth_domain",
    authMethod: "auth_method",
    authWorkstation: "auth_workstation",
    bearerToken: "bearer_token",
    cacheBust: "cache_bust",
    databaseConnectionString: "database_connection_string",
    databaseQuery: "database_query",
    dnsResolveServer: "dns_resolve_server",
    dnsResolveType: "dns_resolve_type",
    domainExpiryNotification: "domain_expiry_notification",
    expectedTlsAlert: "expected_tls_alert",
    expectedValue: "expected_value",
    expiryNotification: "expiry_notification",
    gamedigGivenPortOnly: "gamedig_given_port_only",
    gamedigToken: "gamedig_token",
    grpcBody: "grpc_body",
    grpcEnableTls: "grpc_enable_tls",
    grpcMetadata: "grpc_metadata",
    grpcMethod: "grpc_method",
    grpcProtobuf: "grpc_protobuf",
    grpcServiceName: "grpc_service_name",
    grpcUrl: "grpc_url",
    httpBodyEncoding: "http_body_encoding",
    ignoreTls: "ignore_tls",
    invertKeyword: "invert_keyword",
    ipFamily: "ip_family",
    jsonPath: "json_path",
    jsonPathOperator: "json_path_operator",
    kafkaProducerAllowAutoTopicCreation: "kafka_producer_allow_auto_topic_creation",
    kafkaProducerBrokers: "kafka_producer_brokers",
    kafkaProducerMessage: "kafka_producer_message",
    kafkaProducerSaslOptions: "kafka_producer_sasl_options",
    kafkaProducerSsl: "kafka_producer_ssl",
    kafkaProducerTopic: "kafka_producer_topic",
    manualStatus: "manual_status",
    mqttCheckType: "mqtt_check_type",
    mqttPassword: "mqtt_password",
    mqttSuccessMessage: "mqtt_success_message",
    mqttTopic: "mqtt_topic",
    mqttUsername: "mqtt_username",
    mqttWebsocketPath: "mqtt_websocket_path",
    oauthAudience: "oauth_audience",
    oauthAuthMethod: "oauth_auth_method",
    oauthClientId: "oauth_client_id",
    oauthClientSecret: "oauth_client_secret",
    oauthScopes: "oauth_scopes",
    oauthTokenUrl: "oauth_token_url",
    packetSize: "packet_size",
    pingCount: "ping_count",
    pingNumeric: "ping_numeric",
    pingPerRequestTimeout: "ping_per_request_timeout",
    proxyId: "proxy_id",
    pushToken: "push_token",
    rabbitmqNodes: "rabbitmq_nodes",
    rabbitmqPassword: "rabbitmq_password",
    rabbitmqUsername: "rabbitmq_username",
    radiusCalledStationId: "radius_called_station_id",
    radiusCallingStationId: "radius_calling_station_id",
    radiusPassword: "radius_password",
    radiusSecret: "radius_secret",
    radiusUsername: "radius_username",
    resendInterval: "resend_interval",
    responseMaxLength: "response_max_length",
    retryInterval: "retry_interval",
    retryOnlyOnStatusCodeFailure: "retry_only_on_status_code_failure",
    remoteBrowser: "remote_browser",
    saveErrorResponse: "save_error_response",
    saveResponse: "save_response",
    screenshotDelay: "screenshot_delay",
    smtpSecurity: "smtp_security",
    snmpOid: "snmp_oid",
    snmpVersion: "snmp_version",
    snmpV3Username: "snmp_v3_username",
    systemServiceName: "system_service_name",
    tlsCa: "tls_ca",
    tlsCert: "tls_cert",
    tlsKey: "tls_key",
    upsideDown: "upside_down",
    wsIgnoreSecWebsocketAcceptHeader: "ws_ignore_sec_websocket_accept_header",
    wsSubprotocol: "ws_subprotocol",
};

const monitorColumnTypes = {
    auth_domain: "TEXT",
    auth_method: "TEXT",
    auth_workstation: "TEXT",
    bearer_token: "TEXT",
    cache_bust: "BOOLEAN DEFAULT 0",
    database_connection_string: "TEXT",
    database_query: "TEXT",
    dns_last_result: "TEXT",
    dns_resolve_server: "TEXT",
    dns_resolve_type: "TEXT",
    domain_expiry_notification: "BOOLEAN DEFAULT 1",
    expected_tls_alert: "TEXT",
    expected_value: "TEXT",
    expiry_notification: "BOOLEAN DEFAULT 1",
    gamedig_given_port_only: "BOOLEAN DEFAULT 1",
    gamedig_token: "TEXT",
    grpc_body: "TEXT",
    grpc_enable_tls: "BOOLEAN DEFAULT 0",
    grpc_metadata: "TEXT",
    grpc_method: "TEXT",
    grpc_protobuf: "TEXT",
    grpc_service_name: "TEXT",
    grpc_url: "TEXT",
    http_body_encoding: "TEXT",
    ignore_tls: "BOOLEAN DEFAULT 0",
    invert_keyword: "BOOLEAN DEFAULT 0",
    ip_family: "TEXT",
    json_path: "TEXT",
    json_path_operator: "TEXT",
    kafka_producer_allow_auto_topic_creation: "BOOLEAN DEFAULT 0",
    kafka_producer_brokers: "TEXT",
    kafka_producer_message: "TEXT",
    kafka_producer_sasl_options: "TEXT",
    kafka_producer_ssl: "BOOLEAN DEFAULT 0",
    kafka_producer_topic: "TEXT",
    manual_status: "TEXT",
    mqtt_check_type: "TEXT",
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
    packet_size: "INTEGER",
    ping_count: "INTEGER DEFAULT 1",
    ping_numeric: "BOOLEAN DEFAULT 1",
    ping_per_request_timeout: "INTEGER DEFAULT 2",
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
    resend_interval: "INTEGER DEFAULT 0",
    response_max_length: "INTEGER",
    retry_interval: "INTEGER DEFAULT 20",
    retry_only_on_status_code_failure: "BOOLEAN DEFAULT 0",
    remote_browser: "INTEGER",
    save_error_response: "BOOLEAN DEFAULT 1",
    save_response: "BOOLEAN DEFAULT 0",
    screenshot_delay: "INTEGER DEFAULT 0",
    smtp_security: "TEXT",
    snmp_oid: "TEXT",
    snmp_version: "TEXT",
    snmp_v3_username: "TEXT",
    system_service_name: "TEXT",
    tls_ca: "TEXT",
    tls_cert: "TEXT",
    tls_key: "TEXT",
    upside_down: "BOOLEAN DEFAULT 0",
    ws_ignore_sec_websocket_accept_header: "BOOLEAN DEFAULT 0",
    ws_subprotocol: "TEXT",
};

const monitorBooleanColumns = new Set([
    "cache_bust",
    "domain_expiry_notification",
    "expiry_notification",
    "gamedig_given_port_only",
    "grpc_enable_tls",
    "ignore_tls",
    "invert_keyword",
    "kafka_producer_allow_auto_topic_creation",
    "kafka_producer_ssl",
    "ping_numeric",
    "retry_only_on_status_code_failure",
    "save_error_response",
    "save_response",
    "upside_down",
    "ws_ignore_sec_websocket_accept_header",
]);

const monitorSnakePrecedenceColumns = new Set([
    "response_max_length",
    "retry_only_on_status_code_failure",
    "save_error_response",
    "save_response",
]);

function normalizeSql(sql) {
    return sql.replace(/`/g, '"');
}

function normalizeBoolean(value) {
    if (value === true || value === 1 || value === "1") {
        return true;
    }
    if (value === false || value === 0 || value === "0" || value === "" || value === null || value === undefined) {
        return false;
    }
    return Boolean(value);
}

function normalizeMonitorColumnValue(column, value) {
    if (monitorBooleanColumns.has(column)) {
        return normalizeBoolean(value);
    }
    return value;
}

function normalizeMonitorRow(row) {
    const result = { ...row };
    for (const [property, column] of Object.entries(monitorPropertyColumns)) {
        const hasColumn = result[column] !== undefined && result[column] !== null;
        const hasProperty = result[property] !== undefined && result[property] !== null;
        if (!hasColumn && !hasProperty) {
            continue;
        }

        const value = normalizeMonitorColumnValue(column, hasColumn ? result[column] : result[property]);
        result[column] = value;
        result[property] = value;
    }

    if (result.send_url !== undefined && result.send_url !== null) {
        result.sendUrl = normalizeBoolean(result.send_url);
    }

    if (result.custom_url !== undefined && result.custom_url !== null) {
        result.customUrl = result.custom_url;
    }

    return result;
}

function normalizeRowForStore(table, row) {
    if (table !== "monitor") {
        return row;
    }

    const result = {};
    const mappedProperties = new Set(Object.keys(monitorPropertyColumns));
    for (const [key, value] of Object.entries(row)) {
        if (!mappedProperties.has(key)) {
            result[key] = value;
        }
    }

    for (const [property, column] of Object.entries(monitorPropertyColumns)) {
        const hasProperty = row[property] !== undefined;
        const hasColumn = row[column] !== undefined;
        if (!hasProperty && !hasColumn) {
            continue;
        }

        const preferColumn = monitorSnakePrecedenceColumns.has(column);
        const value = preferColumn && hasColumn ? row[column] : hasProperty ? row[property] : row[column];
        result[column] = normalizeMonitorColumnValue(column, value);
    }

    return result;
}

function beanForTable(table, row = {}) {
    const Model = modelMap[table] ? modelMap[table]() : BeanModel;
    const bean = new Model();
    Object.assign(bean, table === "monitor" ? normalizeMonitorRow(row) : row);
    if (table === "heartbeat") {
        bean._monitorId = row.monitor_id;
        bean._status = row.status;
        bean._time = row.time;
        bean._msg = row.msg;
        bean._ping = row.ping;
        bean._important = row.important;
        bean._duration = row.duration;
        bean._retries = row.retries;
        bean._response = row.response;
    }
    Object.defineProperty(bean, "__table", {
        value: table,
        enumerable: false,
        configurable: true,
    });
    return bean;
}

function conditionSql(condition) {
    const trimmed = condition.trim();
    if (!trimmed) {
        return "";
    }
    if (/^(where|order by|group by|limit)\b/i.test(trimmed)) {
        return condition;
    }
    return ` WHERE ${condition}`;
}

class BunSQLiteRedbean {
    db = null;
    sqlitePath = null;
    dbConfig = { type: "sqlite" };

    get knex() {
        const self = this;
        const fn = function (table) {
            return {
                count(column) {
                    return {
                        async first() {
                            const alias = column.includes(" as ") ? column.split(/\s+as\s+/i).pop() : "count";
                            const row = await self.getRow(`SELECT COUNT(*) AS ${alias} FROM ${table}`);
                            return row || { [alias]: 0 };
                        },
                    };
                },
            };
        };
        fn.migrate = {
            latest: async () => [],
        };
        return fn;
    }

    async connect({ sqlitePath, templatePath, testMode = false }) {
        this.sqlitePath = sqlitePath;
        this.dbConfig = { type: "sqlite" };
        if (!fs.existsSync(sqlitePath)) {
            fs.copyFileSync(templatePath, sqlitePath);
        }

        this.db = new BunDatabase(sqlitePath, { create: true, strict: true });
        this.db.run(testMode ? "PRAGMA journal_mode = MEMORY" : "PRAGMA journal_mode = WAL");
        this.db.run("PRAGMA foreign_keys = ON");
        this.db.run("PRAGMA cache_size = -12000");
        this.db.run("PRAGMA auto_vacuum = INCREMENTAL");
        this.db.run("PRAGMA busy_timeout = 5000");
        this.db.run("PRAGMA synchronous = NORMAL");
        this.ensureBootstrapSchema();
    }

    ensureBootstrapSchema() {
        this.addColumnIfMissing("user", "twofa_secret");
        this.addColumnIfMissing("user", "twofa_status", "INTEGER NOT NULL DEFAULT 0");
        this.addColumnIfMissing("user", "twofa_last_token", "TEXT");
        this.addColumnIfMissing("monitor", "accepted_statuscodes_json", "TEXT");
        this.addColumnIfMissing("monitor", "maxredirects", "INTEGER DEFAULT 10");
        this.addColumnIfMissing("monitor", "timeout", "INTEGER DEFAULT 48");
        this.addColumnIfMissing("monitor", "retry_interval", "INTEGER DEFAULT 20");
        this.addColumnIfMissing("monitor", "resend_interval", "INTEGER DEFAULT 0");
        this.addColumnIfMissing("monitor", "method", "TEXT DEFAULT 'GET'");
        this.addColumnIfMissing("monitor", "body", "TEXT");
        this.addColumnIfMissing("monitor", "headers", "TEXT");
        this.addColumnIfMissing("monitor", "auth_method", "TEXT");
        this.addColumnIfMissing("monitor", "basic_auth_user", "TEXT");
        this.addColumnIfMissing("monitor", "basic_auth_pass", "TEXT");
        this.addColumnIfMissing("monitor", "description", "TEXT");
        this.addColumnIfMissing("monitor", "packet_size", "INTEGER");
        this.addColumnIfMissing("monitor", "parent", "INTEGER");
        this.addColumnIfMissing("monitor", "invert_keyword", "BOOLEAN DEFAULT 0");
        this.addColumnIfMissing("monitor", "json_path", "TEXT");
        this.addColumnIfMissing("monitor", "expected_value", "TEXT");
        this.addColumnIfMissing("monitor", "database_connection_string", "TEXT");
        this.addColumnIfMissing("monitor", "database_query", "TEXT");
        this.addColumnIfMissing("monitor", "docker_container", "TEXT");
        this.addColumnIfMissing("monitor", "docker_host", "INTEGER");
        this.addColumnIfMissing("monitor", "proxy_id", "INTEGER");
        this.addColumnIfMissing("monitor", "expiry_notification", "BOOLEAN DEFAULT 1");
        this.addColumnIfMissing("monitor", "ignore_tls", "BOOLEAN DEFAULT 0");
        this.addColumnIfMissing("monitor", "upside_down", "BOOLEAN DEFAULT 0");
        this.addColumnIfMissing("monitor", "push_token", "TEXT");
        for (const [column, type] of Object.entries(monitorColumnTypes)) {
            this.addColumnIfMissing("monitor", column, type);
        }

        this.db.run(
            "CREATE TABLE IF NOT EXISTS maintenance (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, user_id INTEGER, active BOOLEAN DEFAULT 1, strategy TEXT, start_date DATETIME, end_date DATETIME)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS status_page (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE, title TEXT, description TEXT, icon TEXT, theme TEXT, published BOOLEAN DEFAULT 1, show_tags BOOLEAN DEFAULT 0, domain_name_list TEXT, custom_css TEXT, footer_text TEXT, show_powered_by BOOLEAN DEFAULT 1, google_analytics_tag_id TEXT, created_date DATETIME, modified_date DATETIME)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS status_page_cname (id INTEGER PRIMARY KEY AUTOINCREMENT, status_page_id INTEGER, domain TEXT UNIQUE)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS incident (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, style TEXT, status TEXT, status_page_id INTEGER, created_date DATETIME, last_updated_date DATETIME)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS `group` (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, weight INTEGER DEFAULT 1000, public BOOLEAN DEFAULT 0, status_page_id INTEGER)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS monitor_group (id INTEGER PRIMARY KEY AUTOINCREMENT, monitor_id INTEGER, group_id INTEGER, weight INTEGER DEFAULT 1000, send_url BOOLEAN DEFAULT 0, custom_url TEXT)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS tag (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, color TEXT, user_id INTEGER)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS monitor_tag (id INTEGER PRIMARY KEY AUTOINCREMENT, tag_id INTEGER, monitor_id INTEGER, value TEXT)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS notification_sent_history (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, monitor_id INTEGER, days INTEGER)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS monitor_tls_info (id INTEGER PRIMARY KEY AUTOINCREMENT, monitor_id INTEGER UNIQUE, info_json TEXT)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS api_key (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT, name TEXT, user_id INTEGER, active BOOLEAN DEFAULT 1, expires DATETIME)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS proxy (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, protocol TEXT, host TEXT, port INTEGER, auth BOOLEAN, username TEXT, password TEXT, active BOOLEAN DEFAULT 1, default_proxy BOOLEAN DEFAULT 0)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS docker_host (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, docker_daemon TEXT, docker_type TEXT, name TEXT)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS remote_browser (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, url TEXT)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS stat_minutely (id INTEGER PRIMARY KEY AUTOINCREMENT, monitor_id INTEGER, timestamp DATETIME, ping REAL, up INTEGER, down INTEGER, maintenance INTEGER)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS stat_hourly (id INTEGER PRIMARY KEY AUTOINCREMENT, monitor_id INTEGER, timestamp DATETIME, ping REAL, up INTEGER, down INTEGER, maintenance INTEGER)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS stat_daily (id INTEGER PRIMARY KEY AUTOINCREMENT, monitor_id INTEGER, timestamp DATETIME, ping REAL, up INTEGER, down INTEGER, maintenance INTEGER)"
        );
        this.db.run(
            "CREATE TABLE IF NOT EXISTS domain_expiry (id INTEGER PRIMARY KEY AUTOINCREMENT, last_check DATETIME, domain TEXT UNIQUE NOT NULL, expiry DATETIME, last_expiry_notification_sent INTEGER DEFAULT NULL)"
        );

        this.addColumnIfMissing("incident", "pin", "BOOLEAN DEFAULT 1");
        this.addColumnIfMissing("incident", "active", "BOOLEAN DEFAULT 1");

        this.addColumnIfMissing("status_page", "autoRefreshInterval", "INTEGER DEFAULT 300");
        this.addColumnIfMissing("status_page", "analytics_id", "TEXT");
        this.addColumnIfMissing("status_page", "analytics_script_url", "TEXT");
        this.addColumnIfMissing("status_page", "analytics_type", "TEXT");
        this.addColumnIfMissing("status_page", "rss_title", "TEXT");
        this.addColumnIfMissing("status_page", "show_certificate_expiry", "BOOLEAN DEFAULT 0");
        this.addColumnIfMissing("status_page", "show_only_last_heartbeat", "BOOLEAN DEFAULT 0");
    }

    addColumnIfMissing(table, column, type = "TEXT") {
        const exists = this.db
            .query(`PRAGMA table_info("${table}")`)
            .all()
            .some((row) => row.name === column);
        if (!exists) {
            this.db.run(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`);
        }
    }

    async close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    async autoloadModels() {}

    setup() {}

    freeze() {}

    debug() {}

    dispense(table) {
        return beanForTable(table);
    }

    convertToBeans(table, rows = []) {
        return rows.map((row) => beanForTable(table, row));
    }

    async store(bean) {
        const table = bean.__table;
        if (!table) {
            throw new Error("Cannot store bean without table metadata");
        }

        let row = {};
        for (const [key, value] of Object.entries(bean)) {
            if (key !== "id" && typeof value !== "function") {
                row[key] = value;
            }
        }
        row = normalizeRowForStore(table, row);

        const columns = Object.keys(row);
        if (bean.id) {
            if (columns.length > 0) {
                const assignments = columns.map((column) => `"${column}" = ?`).join(", ");
                try {
                    await this.exec(`UPDATE "${table}" SET ${assignments} WHERE id = ?`, [
                        ...columns.map((column) => row[column]),
                        bean.id,
                    ]);
                } catch (error) {
                    if (!String(error.message).includes("no such column")) {
                        throw error;
                    }
                    for (const column of columns) {
                        this.addColumnIfMissing(table, column);
                    }
                    await this.exec(`UPDATE "${table}" SET ${assignments} WHERE id = ?`, [
                        ...columns.map((column) => row[column]),
                        bean.id,
                    ]);
                }
            }
            return bean.id;
        }

        if (columns.length === 0) {
            const result = this.db.query(`INSERT INTO "${table}" DEFAULT VALUES`).run();
            bean.id = Number(result.lastInsertRowid);
            return bean.id;
        }

        const placeholders = columns.map(() => "?").join(", ");
        let result;
        try {
            result = this.db
                .query(
                    `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${placeholders})`
                )
                .run(...columns.map((column) => row[column]));
        } catch (error) {
            if (!String(error.message).includes("no column named")) {
                throw error;
            }
            for (const column of columns) {
                this.addColumnIfMissing(table, column);
            }
            result = this.db
                .query(
                    `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${placeholders})`
                )
                .run(...columns.map((column) => row[column]));
        }
        bean.id = Number(result.lastInsertRowid);
        return bean.id;
    }

    async exec(sql, params = []) {
        this.db.query(normalizeSql(sql)).run(...params);
    }

    async getAll(sql, params = []) {
        try {
            return this.db.query(normalizeSql(sql)).all(...params);
        } catch (error) {
            if (String(error.message).includes("no such table")) {
                return [];
            }
            throw error;
        }
    }

    async getRow(sql, params = []) {
        try {
            return this.db.query(normalizeSql(sql)).get(...params) || null;
        } catch (error) {
            if (String(error.message).includes("no such table")) {
                return null;
            }
            throw error;
        }
    }

    async getCell(sql, params = []) {
        const row = await this.getRow(sql, params);
        if (!row) {
            return null;
        }
        return row[Object.keys(row)[0]];
    }

    async getCol(sql, params = []) {
        const rows = await this.getAll(sql, params);
        return rows.map((row) => row[Object.keys(row)[0]]);
    }

    async getAssoc(sql, params = []) {
        const rows = await this.getAll(sql, params);
        const result = {};
        for (const row of rows) {
            const keys = Object.keys(row);
            result[row[keys[0]]] = row[keys[1]];
        }
        return result;
    }

    async find(table, condition = "", params = []) {
        const rows = await this.getAll(`SELECT * FROM "${table}" ${conditionSql(condition)}`, params);
        return rows.map((row) => beanForTable(table, row));
    }

    async findAll(table, condition = "", params = []) {
        return this.find(table, condition, params);
    }

    async findOne(table, condition = "", params = []) {
        const row = await this.getRow(`SELECT * FROM "${table}" ${conditionSql(condition)} LIMIT 1`, params);
        return row ? beanForTable(table, row) : null;
    }

    async load(table, id) {
        return this.findOne(table, " id = ? ", [id]);
    }

    async count(table, condition = "", params = []) {
        return Number(await this.getCell(`SELECT COUNT(*) FROM "${table}"${conditionSql(condition)}`, params));
    }

    async hasTable(table) {
        return !!(await this.getCell("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [table]));
    }

    async begin() {
        this.db.run("BEGIN");
        return {
            exec: (...args) => this.exec(...args),
            dispense: (...args) => this.dispense(...args),
            store: (...args) => this.store(...args),
            commit: async () => this.db.run("COMMIT"),
            rollback: async () => this.db.run("ROLLBACK"),
        };
    }

    isoDateTime(value = dayjs.utc()) {
        return dayjs(value).utc().format("YYYY-MM-DD HH:mm:ss");
    }

    isoDateTimeMillis(value = dayjs.utc()) {
        return dayjs(value).utc().format("YYYY-MM-DD HH:mm:ss.SSS");
    }
}

const R = new BunSQLiteRedbean();

export { R, BeanModel, BunSQLiteRedbean };
