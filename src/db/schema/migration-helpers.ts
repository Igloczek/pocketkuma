import type { Database } from "bun:sqlite";
import { resolveColumnType } from "./column-metadata.js";

type SqliteDatabase = Database;

export function columnExists(db: SqliteDatabase, table: string, column: string) {
    return (db.query(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).some(
        (row) => row.name === column
    );
}

export function addColumnIfMissing(db: SqliteDatabase, table: string, column: string, type?: string) {
    if (!columnExists(db, table, column)) {
        const resolvedType = resolveColumnType(table, column, type);
        db.run(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${resolvedType}`);
        return true;
    }
    return false;
}

export function tableExists(db: SqliteDatabase, table: string) {
    const row = db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
    return !!row;
}

export function indexExists(db: SqliteDatabase, indexName: string) {
    const row = db.query("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?").get(indexName);
    return !!row;
}

export function createIndexIfMissing(db: SqliteDatabase, sql: string, indexName: string) {
    if (!indexExists(db, indexName)) {
        db.run(sql);
        return true;
    }
    return false;
}