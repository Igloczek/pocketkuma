// @ts-nocheck

import { describe, test } from "bun:test";
import fs from "fs";
import path from "path";
import Sqlite3Dialect from "knex/lib/dialects/sqlite3/index.js";
import sqlite3 from "@louislam/sqlite3";
import knex from "knex";
import redbean from "redbean-node";
import { createTables } from "../../src/db/knex_init_db.ts";

describe("Database Migration", () => {
    test("SQLite migrations run successfully from fresh database", async () => {
        const testDbPath = path.join(import.meta.dirname, "../../data/test-migration.db");
        const testDbDir = path.dirname(testDbPath);

        // Ensure data directory exists
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }

        // Clean up any existing test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        // Use the same SQLite driver as the project
        Sqlite3Dialect.prototype._driver = () => sqlite3;

        const db = knex({
            client: Sqlite3Dialect,
            connection: {
                filename: testDbPath,
            },
            useNullAsDefault: true,
        });

        // Setup R (redbean) with knex instance like production code does
        const { R } = redbean;
        R.setup(db);

        try {
            // Use production code to initialize SQLite tables (like first run)
            await createTables();

            // Run all migrations like production code does
            await R.knex.migrate.latest({
                directory: path.join(import.meta.dirname, "../../src/db/knex_migrations"),
                loadExtensions: [".ts"],
            });

            // Test passes if migrations complete successfully without errors
        } finally {
            // Clean up
            await R.knex.destroy();
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
        }
    });
});
