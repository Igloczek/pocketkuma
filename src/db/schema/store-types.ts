/**
 * Minimal store surface used by schema upgrades and migration helpers.
 */
export interface MigrationStore {
    db: {
        query(sql: string): {
            all(...params: unknown[]): unknown[];
            get(...params: unknown[]): unknown;
            run(...params: unknown[]): unknown;
        };
        run(sql: string, ...params: unknown[]): unknown;
    };
    hasTable(table: string): Promise<boolean>;
    exec(sql: string, params?: unknown[]): Promise<void>;
    getAll(sql: string, params?: unknown[]): Promise<unknown[]>;
    getCell(sql: string, params?: unknown[]): Promise<unknown>;
    getRow(sql: string, params?: unknown[]): Promise<unknown>;
    count(table: string, condition?: string, params?: unknown[]): Promise<number>;
}