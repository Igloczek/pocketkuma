// @ts-nocheck
"use strict";

import fs from "fs";
import { BeanModel } from "@/server/bean-model";
import { Database as BunDatabase } from "bun:sqlite";
import dayjs from "dayjs";
import {
    filterStoreRow,
    monitorPropertyColumns,
    monitorSnakePrecedenceColumns,
    normalizeBoolean,
    normalizeMonitorColumnValue,
} from "@/db/schema/column-metadata";
import { expectedTableColumns } from "@/db/schema/expected-schema";
import { addColumnIfMissing as addSchemaColumnIfMissing, runPendingUpgrades } from "@/server/db-migrations";
import APIKey from "@/server/model/api_key";
import DomainExpiry from "@/server/model/domain_expiry";
import Group from "@/server/model/group";
import Heartbeat from "@/server/model/heartbeat";
import Incident from "@/server/model/incident";
import Monitor from "@/server/model/monitor";
import StatusPage from "@/server/model/status_page";
import User from "@/server/model/user";

// Static model map keeps compiled binaries working (no runtime .ts require paths).
// Models import BeanModel/R from this module; ESM cycle resolves after this file finishes evaluating.
const modelMap = {
    api_key: APIKey,
    group: Group,
    heartbeat: Heartbeat,
    incident: Incident,
    monitor: Monitor,
    status_page: StatusPage,
    user: User,
    domain_expiry: DomainExpiry,
};

export function registerModel(table, model) {
    modelMap[table] = model;
}

const monitorMappedProperties = new Set(Object.keys(monitorPropertyColumns));

// Generic camelCase -> snake_case aliases for tables that use BeanModel fields in camelCase.
const tablePropertyColumns = {
    monitor: monitorPropertyColumns,
    stat_daily: {
        pingMin: "ping_min",
        pingMax: "ping_max",
        monitorId: "monitor_id",
    },
    stat_hourly: {
        pingMin: "ping_min",
        pingMax: "ping_max",
        monitorId: "monitor_id",
    },
    stat_minutely: {
        pingMin: "ping_min",
        pingMax: "ping_max",
        monitorId: "monitor_id",
    },
    status_page: {
        analyticsId: "analytics_id",
        analyticsScriptUrl: "analytics_script_url",
        analyticsType: "analytics_type",
        autoRefreshInterval: "auto_refresh_interval",
        rssTitle: "rss_title",
        showCertificateExpiry: "show_certificate_expiry",
        showOnlyLastHeartbeat: "show_only_last_heartbeat",
        searchEngineIndex: "search_engine_index",
        showTags: "show_tags",
        footerText: "footer_text",
        customCss: "custom_css",
        showPoweredBy: "show_powered_by",
        createdDate: "created_date",
        modifiedDate: "modified_date",
    },
};

function normalizeSql(sql) {
    return sql.replace(/`/g, '"');
}

function resolveMonitorField(row, property, column, { forStore = false } = {}) {
    const hasColumn = forStore ? row[column] !== undefined : row[column] !== undefined && row[column] !== null;
    const hasProperty = forStore ? row[property] !== undefined : row[property] !== undefined && row[property] !== null;

    if (!hasColumn && !hasProperty) {
        return undefined;
    }

    let raw;
    if (forStore) {
        const preferColumn = monitorSnakePrecedenceColumns.has(column);
        raw = preferColumn && hasColumn ? row[column] : hasProperty ? row[property] : row[column];
    } else {
        raw = hasColumn ? row[column] : row[property];
    }

    return normalizeMonitorColumnValue(column, raw);
}

function normalizeMonitorRow(row) {
    const result = { ...row };
    for (const [property, column] of Object.entries(monitorPropertyColumns)) {
        const value = resolveMonitorField(result, property, column);
        if (value === undefined) {
            continue;
        }
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

function camelToSnake(key) {
    return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function normalizeRowForStore(table, row) {
    // Drop internal bean fields used only for serialization helpers.
    const cleaned = Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith("_")));

    if (table === "monitor") {
        const result = Object.fromEntries(Object.entries(cleaned).filter(([key]) => !monitorMappedProperties.has(key)));

        for (const [property, column] of Object.entries(monitorPropertyColumns)) {
            const value = resolveMonitorField(cleaned, property, column, { forStore: true });
            if (value !== undefined) {
                result[column] = value;
            }
        }

        return result;
    }

    const propertyColumns = tablePropertyColumns[table] || {};
    const allowed = expectedTableColumns[table];
    const result = {};

    for (const [key, value] of Object.entries(cleaned)) {
        if (propertyColumns[key]) {
            const column = propertyColumns[key];
            if (result[column] === undefined) {
                result[column] = value;
            }
            continue;
        }

        if (!allowed || allowed.includes(key)) {
            result[key] = value;
            continue;
        }

        // Generic camelCase -> snake_case fallback for BeanModel fields.
        const snake = camelToSnake(key);
        if (allowed.includes(snake)) {
            if (result[snake] === undefined) {
                result[snake] = value;
            }
            continue;
        }

        // Keep unknown keys so filterStoreRow can fail loudly.
        result[key] = value;
    }

    return result;
}

function beanForTable(table, row = {}) {
    const Model = modelMap[table] || BeanModel;
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
    #transactionOwner = null;
    #transactionQueue = [];
    #processingQueue = false;

    async connect({ sqlitePath, templatePath, testMode = false }) {
        this.sqlitePath = sqlitePath;
        this.dbConfig = { type: "sqlite" };
        if (!fs.existsSync(sqlitePath)) {
            // Bun compiled binaries expose embedded files under `/$bunfs/...`.
            // `fs.copyFileSync` fails there with ENOENT; read+write works.
            fs.writeFileSync(sqlitePath, fs.readFileSync(templatePath));
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

    async addColumnIfMissing(table, column, type) {
        return this.#runDatabaseOperation(null, () => addSchemaColumnIfMissing(this.db, table, column, type));
    }

    async close() {
        return this.#runDatabaseOperation(null, () => {
            if (this.db) {
                this.db.close();
                this.db = null;
            }
        });
    }

    dispense(table) {
        return beanForTable(table);
    }

    convertToBean(table, row = {}) {
        return beanForTable(table, row);
    }

    convertToBeans(table, rows = []) {
        return rows.map((row) => beanForTable(table, row));
    }

    #store(bean) {
        const table = bean.__table;
        if (!table) {
            throw new Error("Cannot store bean without table metadata");
        }

        let row = {};
        for (const [key, value] of Object.entries(bean)) {
            if (key === "id" || key.startsWith("_") || typeof value === "function") {
                continue;
            }
            row[key] = value;
        }
        row = normalizeRowForStore(table, row);
        row = filterStoreRow(table, row);

        const columns = Object.keys(row);
        if (bean.id) {
            if (columns.length > 0) {
                const assignments = columns.map((column) => `"${column}" = ?`).join(", ");
                try {
                    this.#exec(`UPDATE "${table}" SET ${assignments} WHERE id = ?`, [
                        ...columns.map((column) => row[column]),
                        bean.id,
                    ]);
                } catch (error) {
                    if (!String(error.message).includes("no such column")) {
                        throw error;
                    }
                    for (const column of columns) {
                        addSchemaColumnIfMissing(this.db, table, column);
                    }
                    this.#exec(`UPDATE "${table}" SET ${assignments} WHERE id = ?`, [
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
                addSchemaColumnIfMissing(this.db, table, column);
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

    async store(bean) {
        return this.#runDatabaseOperation(null, () => this.#store(bean));
    }

    #trash(bean) {
        const table = bean.__table;
        if (!table) {
            throw new Error("Cannot trash bean without table metadata");
        }
        if (bean.id) {
            this.#exec(`DELETE FROM "${table}" WHERE id = ?`, [bean.id]);
            bean.id = 0;
        }
    }

    async trash(bean) {
        return this.#runDatabaseOperation(null, () => this.#trash(bean));
    }

    #exec(sql, params = []) {
        this.db.query(normalizeSql(sql)).run(...params);
    }

    #getAll(sql, params = []) {
        try {
            return this.db.query(normalizeSql(sql)).all(...params);
        } catch (error) {
            if (String(error.message).includes("no such table")) {
                return [];
            }
            throw error;
        }
    }

    #getRow(sql, params = []) {
        try {
            return this.db.query(normalizeSql(sql)).get(...params) || null;
        } catch (error) {
            if (String(error.message).includes("no such table")) {
                return null;
            }
            throw error;
        }
    }

    #getCell(sql, params = []) {
        const row = this.#getRow(sql, params);
        if (!row) {
            return null;
        }
        return row[Object.keys(row)[0]];
    }

    #getCol(sql, params = []) {
        const rows = this.#getAll(sql, params);
        return rows.map((row) => row[Object.keys(row)[0]]);
    }

    #getAssoc(sql, params = []) {
        const rows = this.#getAll(sql, params);
        const result = {};
        for (const row of rows) {
            const keys = Object.keys(row);
            result[row[keys[0]]] = row[keys[1]];
        }
        return result;
    }

    #find(table, condition = "", params = []) {
        const rows = this.#getAll(`SELECT * FROM "${table}" ${conditionSql(condition)}`, params);
        return rows.map((row) => beanForTable(table, row));
    }

    #findOne(table, condition = "", params = []) {
        const row = this.#getRow(`SELECT * FROM "${table}" ${conditionSql(condition)} LIMIT 1`, params);
        return row ? beanForTable(table, row) : null;
    }

    async exec(sql, params = []) {
        return this.#runDatabaseOperation(null, () => this.#exec(sql, params));
    }

    async getAll(sql, params = []) {
        return this.#runDatabaseOperation(null, () => this.#getAll(sql, params));
    }

    async getRow(sql, params = []) {
        return this.#runDatabaseOperation(null, () => this.#getRow(sql, params));
    }

    async getCell(sql, params = []) {
        return this.#runDatabaseOperation(null, () => this.#getCell(sql, params));
    }

    async getCol(sql, params = []) {
        return this.#runDatabaseOperation(null, () => this.#getCol(sql, params));
    }

    async getAssoc(sql, params = []) {
        return this.#runDatabaseOperation(null, () => this.#getAssoc(sql, params));
    }

    async find(table, condition = "", params = []) {
        return this.#runDatabaseOperation(null, () => this.#find(table, condition, params));
    }

    async findAll(table, condition = "", params = []) {
        return this.#runDatabaseOperation(null, () => this.#find(table, condition, params));
    }

    async findOne(table, condition = "", params = []) {
        return this.#runDatabaseOperation(null, () => this.#findOne(table, condition, params));
    }

    async load(table, id) {
        return this.#runDatabaseOperation(null, () => this.#findOne(table, " id = ? ", [id]));
    }

    async count(table, condition = "", params = []) {
        return this.#runDatabaseOperation(null, () =>
            Number(this.#getCell(`SELECT COUNT(*) FROM "${table}"${conditionSql(condition)}`, params))
        );
    }

    async hasTable(table) {
        return this.#runDatabaseOperation(
            null,
            () => !!this.#getCell("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [table])
        );
    }

    #runDatabaseOperation(owner, operation) {
        if (owner !== null) {
            if (owner !== this.#transactionOwner) {
                throw new Error("Transaction has finished");
            }
            return operation();
        }

        if (!this.#transactionOwner && !this.#processingQueue && this.#transactionQueue.length === 0) {
            return operation();
        }

        return new Promise((resolve, reject) => {
            this.#transactionQueue.push({ type: "operation", operation, resolve, reject });
            this.#drainTransactionQueue();
        });
    }

    #drainTransactionQueue() {
        if (this.#transactionOwner || this.#processingQueue) {
            return;
        }

        const item = this.#transactionQueue.shift();
        if (!item) {
            return;
        }

        if (item.type === "transaction") {
            const owner = Symbol("sqlite-transaction");
            this.#transactionOwner = owner;
            try {
                this.db.run("BEGIN");
                item.resolve(this.#createTransaction(owner));
            } catch (error) {
                this.#transactionOwner = null;
                item.reject(error);
                this.#drainTransactionQueue();
            }
            return;
        }

        this.#processingQueue = true;
        Promise.resolve()
            .then(item.operation)
            .then(item.resolve, item.reject)
            .finally(() => {
                this.#processingQueue = false;
                this.#drainTransactionQueue();
            });
    }

    #createTransaction(owner) {
        let finished = false;
        const run = (operation) => {
            if (finished) {
                throw new Error("Transaction has finished");
            }
            return this.#runDatabaseOperation(owner, operation);
        };
        const finish = async (command) => {
            if (finished) {
                return;
            }
            if (owner !== this.#transactionOwner) {
                throw new Error("Transaction has finished");
            }
            finished = true;
            try {
                this.db.run(command);
            } catch (error) {
                if (command === "COMMIT") {
                    try {
                        this.db.run("ROLLBACK");
                    } catch {}
                }
                throw error;
            } finally {
                if (owner === this.#transactionOwner) {
                    this.#transactionOwner = null;
                    this.#drainTransactionQueue();
                }
            }
        };
        return {
            exec: async (sql, params = []) => run(() => this.#exec(sql, params)),
            getAll: async (sql, params = []) => run(() => this.#getAll(sql, params)),
            getRow: async (sql, params = []) => run(() => this.#getRow(sql, params)),
            getCell: async (sql, params = []) => run(() => this.#getCell(sql, params)),
            hasTable: async (table) =>
                run(() => !!this.#getCell("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [table])),
            dispense: (...args) => this.dispense(...args),
            store: async (bean) => run(() => this.#store(bean)),
            trash: async (bean) => run(() => this.#trash(bean)),
            commit: () => finish("COMMIT"),
            rollback: () => finish("ROLLBACK"),
        };
    }

    async begin() {
        return new Promise((resolve, reject) => {
            this.#transactionQueue.push({ type: "transaction", resolve, reject });
            this.#drainTransactionQueue();
        });
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
