// @ts-nocheck

import { PocketKumaServer } from "@/server/pocketkuma-server";
import { clearOldData } from "@/server/jobs/clear-old-data";
import { incrementalVacuum } from "@/server/jobs/incremental-vacuum";
import Cron from "croner";
import type { SQLiteStore } from "@/server/db-migrations";
import type { DatabaseMaintenanceCoordinator } from "@/server/database-maintenance";
import { Settings } from "@/server/settings";

const jobs = [
    {
        name: "clear-old-data",
        interval: "14 03 * * *",
        jobFunc: clearOldData,
        exclusive: true,
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
    CronClass = Cron,
    settings = new Settings(store),
    heartbeatData = null
) {
    for (const job of jobs) {
        const cornerJob = new CronClass(
            job.interval,
            {
                name: job.name,
                timezone,
            },
            () => coordinator[job.exclusive ? "maintain" : "run"](() => job.jobFunc(store, settings, heartbeatData))
        );
        job.croner = cornerJob;
    }
};

const initBackgroundJobs = async function (
    store: SQLiteStore,
    coordinator: DatabaseMaintenanceCoordinator,
    settings = new Settings(store),
    heartbeatData = null
) {
    const timezone = await PocketKumaServer.getInstance().getTimezone();
    scheduleBackgroundJobs(store, coordinator, timezone, Cron, settings, heartbeatData);
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
