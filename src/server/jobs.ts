// @ts-nocheck

import { PocketKumaServer } from "@/server/pocketkuma-server";
import { clearOldData } from "@/server/jobs/clear-old-data";
import { incrementalVacuum } from "@/server/jobs/incremental-vacuum";
import Cron from "croner";
import type { SQLiteStore } from "@/server/db-migrations";
import type { DatabaseMaintenanceCoordinator } from "@/server/database-maintenance";

const jobs = [
    {
        name: "clear-old-data",
        interval: "14 03 * * *",
        jobFunc: clearOldData,
        croner: null,
    },
    {
        name: "incremental-vacuum",
        interval: "*/5 * * * *",
        jobFunc: incrementalVacuum,
        croner: null,
    },
];

/**
 * Initialize background jobs
 * @returns {Promise<void>}
 */
const scheduleBackgroundJobs = function (
    store: SQLiteStore,
    coordinator: DatabaseMaintenanceCoordinator,
    timezone,
    CronClass = Cron
) {
    for (const job of jobs) {
        const cornerJob = new CronClass(
            job.interval,
            {
                name: job.name,
                timezone,
            },
            () => coordinator.run(() => job.jobFunc(store))
        );
        job.croner = cornerJob;
    }
};

const initBackgroundJobs = async function (store: SQLiteStore, coordinator: DatabaseMaintenanceCoordinator) {
    const timezone = await PocketKumaServer.getInstance().getTimezone();
    scheduleBackgroundJobs(store, coordinator, timezone);
};

/**
 * Stop all background jobs if running
 * @returns {void}
 */
const stopBackgroundJobs = function () {
    for (const job of jobs) {
        if (job.croner) {
            job.croner.stop();
            job.croner = null;
        }
    }
};

export { initBackgroundJobs, scheduleBackgroundJobs, stopBackgroundJobs };
