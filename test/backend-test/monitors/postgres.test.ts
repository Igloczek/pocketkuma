// @ts-nocheck

import { describe, test, expect } from "bun:test";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { PostgresMonitorType } from "../../../src/server/monitor-types/postgres.ts";
import { UP, PENDING } from "../../../src/util.ts";

describe.skipIf(!!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"))(
    "Postgres Single Node",
    () => {
        test("check() sets status to UP when Postgres server is reachable", async () => {
            // The default timeout of 30 seconds might not be enough for the container to start
            const postgresContainer = await new PostgreSqlContainer("postgres:latest")
                .withStartupTimeout(60000)
                .start();
            const postgresMonitor = new PostgresMonitorType();
            const monitor = {
                databaseConnectionString: postgresContainer.getConnectionUri(),
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await postgresMonitor.check(monitor, heartbeat);
                expect(heartbeat.status).toBe(UP);
            } finally {
                postgresContainer.stop();
            }
        });

        test("check() rejects when Postgres server is not reachable", async () => {
            const postgresMonitor = new PostgresMonitorType();
            const monitor = {
                databaseConnectionString: "http://localhost:15432",
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            // regex match any string
            const regex = /.+/;

            await expect(postgresMonitor.check(monitor, heartbeat)).rejects.toThrow(regex);
        });
    }
);
