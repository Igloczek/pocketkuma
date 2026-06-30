// @ts-nocheck

/**
 * Run incremental_vacuum and checkpoint the WAL.
 * @returns {Promise<void>} A promise that resolves when the process is finished.
 */

import { R } from "@/server/bun-sqlite-store";
import { log } from "@/util";

const incrementalVacuum = async () => {
    try {
        log.debug("incrementalVacuum", "Running incremental_vacuum and wal_checkpoint(PASSIVE)...");
        await R.exec("PRAGMA incremental_vacuum(200)");
        await R.exec("PRAGMA wal_checkpoint(PASSIVE)");
    } catch (e) {
        log.error("incrementalVacuum", `Failed: ${e.message}`);
    }
};

export { incrementalVacuum };
