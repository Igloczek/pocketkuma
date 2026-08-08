// @ts-nocheck

import { MonitorType } from "@/server/monitor-types/monitor-type";
import { log } from "@/server/logger";
import { UP } from "@/constants";
import dayjs from "dayjs";
import { parse as postgresConParse } from "pg-connection-string";
import pg from "pg";

const { Client } = pg;

class PostgresMonitorType extends MonitorType {
    name = "postgres";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let startTime = dayjs().valueOf();

        let query = monitor.databaseQuery;
        // No query provided by user, use SELECT 1
        if (!query || (typeof query === "string" && query.trim() === "")) {
            query = "SELECT 1";
        }
        const configuredTimeout = monitor.getEffectiveTimeout?.() ?? Number(monitor.timeout);
        const timeout = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 20;
        await this.postgresQuery(monitor.databaseConnectionString, query, timeout * 1000);

        heartbeat.msg = "";
        heartbeat.status = UP;
        heartbeat.ping = dayjs().valueOf() - startTime;
    }

    /**
     * Run a query on Postgres
     * @param {string} connectionString The database connection string
     * @param {string} query The query to validate the database with
     * @param {number} timeout Connection and query timeout in milliseconds
     * @returns {Promise<(string[] | object[] | object)>} Response from
     * server
     */
    async postgresQuery(connectionString, query, timeout) {
        const deadline = Date.now() + timeout;
        const config = postgresConParse(connectionString);

        // Fix #3868, which true/false is not parsed to boolean
        if (typeof config.ssl === "string") {
            config.ssl = config.ssl === "true";
        }

        if (config.password === "") {
            // See https://github.com/brianc/node-postgres/issues/1927
            throw new Error("Password is undefined.");
        }

        const client = new Client({
            ...config,
            connectionTimeoutMillis: timeout,
            query_timeout: timeout,
        });
        client.on("error", () => log.debug(this.name, "Error caught in the error event handler."));

        try {
            await client.connect();
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                throw new Error("PostgreSQL monitor timed out");
            }
            return await client.query({ text: query, query_timeout: remaining });
        } finally {
            await client.end();
        }
    }
}

export { PostgresMonitorType };
