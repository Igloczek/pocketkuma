// @ts-nocheck
"use strict";

import { createRequire } from "node:module";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Database as BunDatabase } from "bun:sqlite";
import dayjs from "dayjs";
import { filterStoreRow } from "@/db/schema/column-metadata";
import { addColumnIfMissing as addSchemaColumnIfMissing, runPendingUpgrades } from "@/server/db-migrations";

// Bun-only hybrid: lazy require() avoids top-level model imports that would create
// circular dependencies with redbean-compat. Node CJS/ESM resolution does not support
// require("./model/*.ts") the same way; this store is only used under Bun.
const require = createRequire(import.meta.url);
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveImportPath(modulePath) {
    if (modulePath.startsWith("@/")) {
        const resolved = path.join(srcDir, modulePath.slice(2));
        if (!path.extname(resolved)) {
            return `${resolved}.ts`;
        }
        return resolved;
    }
    return modulePath;
}

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
    const module = require(resolveImportPath(modulePath));
    return module.default ?? module;
}

// Tables with model classes that expose instance methods (e.g. getExpiryDate) must be listed here.
// All other tables fall back to plain BeanModel in beanForTable().
const modelMap = {
    group: () => loadModel("@/server/model/group"),
    heartbeat: () => loadModel("@/server/model/heartbeat"),
    incident: () => loadModel("@/server/model/incident"),
    monitor: () => loadModel("@/server/model/monitor"),
    status_page: () => loadModel("@/server/model/status_page"),
    user: () => loadModel("@/server/model/user"),
    domain_expiry: () => loadModel("@/server/model/domain_expiry"),
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
        await runPendingUpgrades(this);
    }

    addColumnIfMissing(table, column, type) {
        addSchemaColumnIfMissing(this.db, table, column, type);
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

    convertToBean(table, row = {}) {
        return beanForTable(table, row);
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
        row = filterStoreRow(table, row);

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
