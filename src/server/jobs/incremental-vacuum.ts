// @ts-nocheck

/**
 * Run incremental_vacuum and checkpoint the WAL.
 * @returns {Promise<void>} A promise that resolves when the process is finished.
 */

import { R } from "../redbean-compat.ts";
import { log } from "../../util.ts";
import Database from "../database.ts";

const incrementalVacuum = async () => {
    try {
        if (Database.dbConfig.type !== "sqlite") {
            log.debug("incrementalVacuum", "Skipping incremental_vacuum, not using SQLite.");
            return;
        }

        log.debug("incrementalVacuum", "Running incremental_vacuum and wal_checkpoint(PASSIVE)...");
        await R.exec("PRAGMA incremental_vacuum(200)");
        await R.exec("PRAGMA wal_checkpoint(PASSIVE)");
    } catch (e) {
        log.error("incrementalVacuum", `Failed: ${e.message}`);
    }
};

export { incrementalVacuum };
