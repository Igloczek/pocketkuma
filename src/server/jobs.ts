// @ts-nocheck

import { clearOldData } from "@/server/jobs/clear-old-data";
import { incrementalVacuum } from "@/server/jobs/incremental-vacuum";
import Cron from "croner";
import type { SQLiteStore } from "@/server/db-migrations";
import type { DatabaseMaintenanceCoordinator } from "@/server/database-maintenance";

const jobDefinitions = [
    {
        name: "clear-old-data",
        interval: "14 03 * * *",
        jobFunc: clearOldData,
        exclusive: true,
    },
    {
        name: "incremental-vacuum",
        interval: "*/5 * * * *",
        jobFunc: incrementalVacuum,
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
    CronClass = Cron,
    settings,
    heartbeatData = null,
    scheduledJobs = []
) {
    for (const job of jobDefinitions) {
        const cornerJob = new CronClass(
            job.interval,
            {
                name: job.name,
                timezone,
            },
            () => coordinator[job.exclusive ? "maintain" : "run"](() => job.jobFunc(store, settings, heartbeatData))
        );
        scheduledJobs.push(cornerJob);
    }
    return scheduledJobs;
};

const initBackgroundJobs = async function (
    store: SQLiteStore,
    coordinator: DatabaseMaintenanceCoordinator,
    timezone,
    settings,
    heartbeatData = null,
    scheduledJobs = []
) {
    return scheduleBackgroundJobs(store, coordinator, timezone, Cron, settings, heartbeatData, scheduledJobs);
};

/**
 * Stop all background jobs if running
 * @returns {void}
 */
const stopBackgroundJobs = function (scheduledJobs) {
    for (const job of scheduledJobs.splice(0)) {
        job.stop();
    }
};

export { initBackgroundJobs, scheduleBackgroundJobs, stopBackgroundJobs };
