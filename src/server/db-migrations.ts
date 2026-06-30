import type { BunSQLiteRedbean } from "./bun-sqlite-store.js";
import { upgrade001BunaBaselineData, upgrade001BunaBaselineSchema } from "../db/schema/upgrades/001-buna-baseline.js";
import { log } from "../util.js";

export {
    addColumnIfMissing,
    columnExists,
    createIndexIfMissing,
    indexExists,
    tableExists,
} from "../db/schema/migration-helpers.js";

export const BUNA_SCHEMA_VERSION_KEY = "buna_schema_version";
export const LATEST_BUNA_SCHEMA_VERSION = 1;

/**
 * Upgrade recovery notes:
 * - SQLite implicitly commits DDL (CREATE/ALTER/CREATE INDEX) even inside BEGIN.
 * - Schema-phase changes from 001 may persist if the data-phase transaction fails.
 * - DML (GameDig rewrites, LINE Notify deletes, etc.) rolls back with the data transaction.
 * - buna_schema_version is only bumped after the data phase succeeds.
 * - On failure: restart to retry; schema steps are idempotent, data migrations re-run.
 * - For severely broken DBs: restore from backup or replace with a fresh src/db/kuma.db.
 */

interface SchemaUpgrade {
    version: number;
    name: string;
    runSchema?: (store: BunSQLiteRedbean) => Promise<void>;
    runData?: (store: BunSQLiteRedbean) => Promise<void>;
}

const upgrades: SchemaUpgrade[] = [
    {
        version: 1,
        name: "001-buna-baseline",
        runSchema: upgrade001BunaBaselineSchema,
        runData: upgrade001BunaBaselineData,
    },
];

export async function getBunaSchemaVersion(store: BunSQLiteRedbean) {
    if (!(await store.hasTable("setting"))) {
        return null;
    }

    const value = await store.getCell('SELECT value FROM setting WHERE "key" = ?', [BUNA_SCHEMA_VERSION_KEY]);
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
}

export async function setBunaSchemaVersion(store: BunSQLiteRedbean, version: number) {
    const existing = await store.getRow('SELECT id FROM setting WHERE "key" = ?', [BUNA_SCHEMA_VERSION_KEY]);
    if (existing) {
        await store.exec('UPDATE setting SET value = ? WHERE "key" = ?', [String(version), BUNA_SCHEMA_VERSION_KEY]);
        return;
    }

    await store.exec('INSERT INTO setting ("key", value) VALUES (?, ?)', [BUNA_SCHEMA_VERSION_KEY, String(version)]);
}

export async function resolveCurrentSchemaVersion(store: BunSQLiteRedbean) {
    const explicitVersion = await getBunaSchemaVersion(store);
    if (explicitVersion !== null) {
        return explicitVersion;
    }

    log.info("db", "No buna_schema_version found; treating database as upstream Uptime Kuma 2.x baseline");
    return 0;
}

export async function runPendingUpgrades(store: BunSQLiteRedbean) {
    let currentVersion = await resolveCurrentSchemaVersion(store);

    for (const upgrade of upgrades) {
        if (currentVersion >= upgrade.version) {
            continue;
        }

        log.info("db", `Running schema upgrade ${upgrade.name} (v${upgrade.version})`);

        if (upgrade.runSchema) {
            log.debug("db", `Applying schema phase for ${upgrade.name} (DDL auto-commits in SQLite)`);
            await upgrade.runSchema(store);
        }

        store.db.run("BEGIN");
        try {
            if (upgrade.runData) {
                await upgrade.runData(store);
            }
            await setBunaSchemaVersion(store, upgrade.version);
            store.db.run("COMMIT");
            currentVersion = upgrade.version;
            log.info("db", `Schema upgrade ${upgrade.name} completed`);
        } catch (error) {
            store.db.run("ROLLBACK");
            log.error(
                "db",
                `Schema upgrade ${upgrade.name} data phase failed; DML rolled back (DDL changes from schema phase may persist)`
            );
            throw error;
        }
    }
}