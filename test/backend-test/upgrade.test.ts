// @ts-nocheck

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Database as BunDatabase } from "bun:sqlite";
import { applySqlFile } from "@/db/schema/sql-utils";
import { BunSQLiteRedbean } from "@/server/bun-sqlite-store";
import { BUNA_SCHEMA_VERSION_KEY, getBunaSchemaVersion } from "@/server/db-migrations";

const projectRoot = path.join(import.meta.dirname, "../..");
const baselineFixturePath = path.join(import.meta.dirname, "fixtures/upstream-kuma-baseline.sql");
const knexEndstateFixturePath = path.join(import.meta.dirname, "fixtures/upstream-kuma-knex-endstate.sql");
const templatePath = path.join(projectRoot, "src/db/kuma.db");

function loadSqlFixture(dbPath, sql) {
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
    }

    const db = new BunDatabase(dbPath, { create: true, strict: true });
    try {
        applySqlFile(db, sql);
    } finally {
        db.close();
    }
}

function readSettingValue(dbPath, key) {
    const db = new BunDatabase(dbPath, { readonly: true });
    try {
        return db.query('SELECT value FROM setting WHERE "key" = ?').get(key)?.value;
    } finally {
        db.close();
    }
}

function readUserCount(dbPath) {
    const db = new BunDatabase(dbPath, { readonly: true });
    try {
        return db.query("SELECT COUNT(*) AS count FROM user").get().count;
    } finally {
        db.close();
    }
}

describe("Upstream Kuma upgrade", () => {
    let dir;
    let store;

    beforeEach(async () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "uptime-buna-upgrade-"));
        const dbPath = path.join(dir, "kuma.db");
        const sql = fs.readFileSync(baselineFixturePath, "utf8");
        loadSqlFixture(dbPath, sql);

        store = new BunSQLiteRedbean();
        await store.connect({
            sqlitePath: dbPath,
            templatePath: dbPath,
            testMode: true,
        });
    });

    afterEach(async () => {
        await store.close();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test("001-buna-baseline migrates upstream Kuma data and sets schema version", async () => {
        expect(await getBunaSchemaVersion(store)).toBe(1);

        const schemaVersion = await store.getCell('SELECT value FROM setting WHERE "key" = ?', [
            BUNA_SCHEMA_VERSION_KEY,
        ]);
        expect(schemaVersion).toBe("1");

        const gamedigGame = await store.getCell("SELECT game FROM monitor WHERE name = ?", ["GameDig TF2"]);
        expect(gamedigGame).toBe("teamfortress2");

        const snmpOperator = await store.getCell("SELECT json_path_operator FROM monitor WHERE name = ?", [
            "SNMP monitor",
        ]);
        expect(snmpOperator).toBe("==");

        const analyticsId = await store.getCell("SELECT analytics_id FROM status_page WHERE slug = ?", ["default"]);
        expect(analyticsId).toBe("G-LEGACY");

        const analyticsType = await store.getCell("SELECT analytics_type FROM status_page WHERE slug = ?", ["default"]);
        expect(analyticsType).toBe("google");

        const refreshInterval = await store.getCell("SELECT auto_refresh_interval FROM status_page WHERE slug = ?", [
            "default",
        ]);
        expect(refreshInterval).toBe(120);

        const lineNotifyCount = await store.count("notification");
        expect(lineNotifyCount).toBe(0);

        const monitorNotificationCount = await store.count("monitor_notification");
        expect(monitorNotificationCount).toBe(0);

        const domainExpiryDisabled = await store.getCell(
            "SELECT domain_expiry_notification FROM monitor WHERE name = ?",
            ["GameDig TF2"]
        );
        expect(Number(domainExpiryDisabled)).toBe(0);
    });
});

describe("Upstream Kuma Knex end-state", () => {
    let dir;
    let store;

    beforeEach(async () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "uptime-buna-knex-endstate-"));
        const dbPath = path.join(dir, "kuma.db");
        const sql = fs.readFileSync(knexEndstateFixturePath, "utf8");
        loadSqlFixture(dbPath, sql);

        expect(readSettingValue(dbPath, BUNA_SCHEMA_VERSION_KEY)).toBeUndefined();

        store = new BunSQLiteRedbean();
        await store.connect({
            sqlitePath: dbPath,
            templatePath: dbPath,
            testMode: true,
        });
    });

    afterEach(async () => {
        await store.close();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test("001-buna-baseline runs when marker columns exist but buna_schema_version is absent", async () => {
        expect(await getBunaSchemaVersion(store)).toBe(1);

        const gamedigGame = await store.getCell("SELECT game FROM monitor WHERE name = ?", ["GameDig TF2"]);
        expect(gamedigGame).toBe("teamfortress2");

        const snmpOperator = await store.getCell("SELECT json_path_operator FROM monitor WHERE name = ?", [
            "SNMP monitor",
        ]);
        expect(snmpOperator).toBe("==");

        expect(await store.count("notification")).toBe(0);
        expect(await store.count("monitor_notification")).toBe(0);

        const domainExpiryDisabled = await store.getCell(
            "SELECT domain_expiry_notification FROM monitor WHERE name = ?",
            ["GameDig TF2"]
        );
        expect(Number(domainExpiryDisabled)).toBe(0);
    });
});

describe("Fresh Buna template", () => {
    let dir;
    let store;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "uptime-buna-fresh-"));
    });

    afterEach(async () => {
        if (store) {
            await store.close();
        }
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test("pre-seeded template skips upgrade and does not mutate schema version", async () => {
        const dbPath = path.join(dir, "kuma.db");
        fs.copyFileSync(templatePath, dbPath);

        const beforeVersion = readSettingValue(dbPath, BUNA_SCHEMA_VERSION_KEY);
        expect(beforeVersion).toBe("1");

        const beforeUserCount = readUserCount(dbPath);

        store = new BunSQLiteRedbean();
        await store.connect({
            sqlitePath: dbPath,
            templatePath: dbPath,
            testMode: true,
        });

        expect(await getBunaSchemaVersion(store)).toBe(1);
        expect(await store.count("user")).toBe(beforeUserCount);
        expect(await store.count("notification")).toBe(0);
    });
});