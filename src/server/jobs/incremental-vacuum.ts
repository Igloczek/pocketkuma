// @ts-nocheck

/**
 * Run incremental_vacuum and checkpoint the WAL.
 * @returns {Promise<void>} A promise that resolves when the process is finished.
 */

import type { SQLiteStore } from "@/server/db-migrations";
import { log } from "@/server/logger";

const incrementalVacuum = async (store: SQLiteStore) => {
    try {
        log.debug("incrementalVacuum", "Running incremental_vacuum and wal_checkpoint(PASSIVE)...");
        await store.exec("PRAGMA incremental_vacuum(200)");
        await store.exec("PRAGMA wal_checkpoint(PASSIVE)");
    } catch (e) {
        log.error("incrementalVacuum", `Failed: ${e.message}`);
    }
};

export { incrementalVacuum };
