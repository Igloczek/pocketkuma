// @ts-nocheck

import type { SQLiteStore } from "@/server/db-migrations";
import { log } from "@/server/logger";
import Database from "@/server/database";
import type { Settings } from "@/server/settings";
import dayjs from "dayjs";

const DEFAULT_KEEP_PERIOD = 365;

/**
 * Clears old data from the heartbeat table and the stat_daily of the database.
 * @returns {Promise<void>} A promise that resolves when the data has been cleared.
 */
const clearOldData = async (store: SQLiteStore, settings: Settings, heartbeatData = null) => {
    await Database.clearHeartbeatData(store);
    let period = await settings.get("keepDataPeriodDays");

    // Set Default Period
    if (period === null || period === undefined) {
        await settings.set("keepDataPeriodDays", DEFAULT_KEEP_PERIOD, "general");
        period = DEFAULT_KEEP_PERIOD;
    }

    // Try parse setting
    let parsedPeriod = Number.parseInt(period, 10);
    if (!Number.isFinite(parsedPeriod)) {
        log.warn("clearOldData", "Failed to parse setting, resetting to default..");
        await settings.set("keepDataPeriodDays", DEFAULT_KEEP_PERIOD, "general");
        parsedPeriod = DEFAULT_KEEP_PERIOD;
    }

    if (parsedPeriod < 1) {
        log.info(
            "clearOldData",
            `Data deletion has been disabled as period is less than 1. Period is ${parsedPeriod} days.`
        );
    } else {
        log.debug("clearOldData", `Clearing Data older than ${parsedPeriod} days...`);
        const sqlHourOffset = Database.sqlHourOffset();

        try {
            // Heartbeat
            await store.exec("DELETE FROM heartbeat WHERE time < " + sqlHourOffset, [parsedPeriod * -24]);

            let timestamp = dayjs().subtract(parsedPeriod, "day").utc().startOf("day").unix();

            // stat_daily
            await store.exec("DELETE FROM stat_daily WHERE timestamp < ? ", [timestamp]);

            await store.exec("PRAGMA optimize;");
        } catch (e) {
            log.error("clearOldData", `Failed to clear old data: ${e.message}`);
        }
    }

    heartbeatData?.reset();
    log.debug("clearOldData", "Data cleared.");
};

export { clearOldData };
