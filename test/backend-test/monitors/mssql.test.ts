// @ts-nocheck

/**
 * Helper function to create and start a MSSQL container
 * @returns {Promise<{container: MSSQLServerContainer, connectionString: string}>} The started container and connection string
 */
import { describe, test, expect } from "bun:test";
import { MSSQLServerContainer } from "@testcontainers/mssqlserver";
import { MssqlMonitorType } from "../../../src/server/monitor-types/mssql.ts";
import { UP, PENDING } from "../../../src/util.ts";

async function createAndStartMSSQLContainer() {
    const container = await new MSSQLServerContainer("mcr.microsoft.com/mssql/server:2022-latest")
        .acceptLicense()
        // The default timeout of 30 seconds might not be enough for the container to start
        .withStartupTimeout(60000)
        .start();

    return {
        container,
        connectionString: container.getConnectionUri(false),
    };
}

describe.skipIf(!!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"))("MSSQL Monitor", () => {
    test("check() sets status to UP when MSSQL server is reachable", async () => {
        const { container, connectionString } = await createAndStartMSSQLContainer();

        const mssqlMonitor = new MssqlMonitorType();
        const monitor = {
            databaseConnectionString: connectionString,
            conditions: "[]",
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await mssqlMonitor.check(monitor, heartbeat, {});
            expect(heartbeat.status).toBe(UP);
        } finally {
            await container.stop();
        }
    });

    test("check() rejects when MSSQL server is not reachable", async () => {
        const mssqlMonitor = new MssqlMonitorType();
        const monitor = {
            databaseConnectionString: "Server=localhost,15433;Database=master;User Id=Fail;Password=Fail;Encrypt=false",
            conditions: "[]",
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await expect(mssqlMonitor.check(monitor, heartbeat, {})).rejects.toEqual(
            new Error(
                "Database connection/query failed: Failed to connect to localhost:15433 - Could not connect (sequence)"
            )
        );
        expect(heartbeat.status).not.toBe(UP);
    });

    test("check() sets status to UP when custom query returns single value", async () => {
        const { container, connectionString } = await createAndStartMSSQLContainer();

        const mssqlMonitor = new MssqlMonitorType();
        const monitor = {
            databaseConnectionString: connectionString,
            databaseQuery: "SELECT 42",
            conditions: "[]",
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await mssqlMonitor.check(monitor, heartbeat, {});
            expect(heartbeat.status).toBe(UP);
        } finally {
            await container.stop();
        }
    });

    test("check() sets status to UP when custom query result meets condition", async () => {
        const { container, connectionString } = await createAndStartMSSQLContainer();

        const mssqlMonitor = new MssqlMonitorType();
        const monitor = {
            databaseConnectionString: connectionString,
            databaseQuery: "SELECT 42 AS value",
            conditions: JSON.stringify([
                {
                    type: "expression",
                    andOr: "and",
                    variable: "result",
                    operator: "equals",
                    value: "42",
                },
            ]),
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await mssqlMonitor.check(monitor, heartbeat, {});
            expect(heartbeat.status).toBe(UP);
        } finally {
            await container.stop();
        }
    });

    test("check() rejects when custom query result does not meet condition", async () => {
        const { container, connectionString } = await createAndStartMSSQLContainer();

        const mssqlMonitor = new MssqlMonitorType();
        const monitor = {
            databaseConnectionString: connectionString,
            databaseQuery: "SELECT 99 AS value",
            conditions: JSON.stringify([
                {
                    type: "expression",
                    andOr: "and",
                    variable: "result",
                    operator: "equals",
                    value: "42",
                },
            ]),
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await expect(mssqlMonitor.check(monitor, heartbeat, {})).rejects.toEqual(
                new Error("Query result did not meet the specified conditions (99)")
            );
            expect(heartbeat.status).toBe(PENDING);
        } finally {
            await container.stop();
        }
    });

    test("check() rejects when query returns no results with conditions", async () => {
        const { container, connectionString } = await createAndStartMSSQLContainer();

        const mssqlMonitor = new MssqlMonitorType();
        const monitor = {
            databaseConnectionString: connectionString,
            databaseQuery: "SELECT 1 WHERE 1 = 0",
            conditions: JSON.stringify([
                {
                    type: "expression",
                    andOr: "and",
                    variable: "result",
                    operator: "equals",
                    value: "1",
                },
            ]),
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await expect(mssqlMonitor.check(monitor, heartbeat, {})).rejects.toEqual(
                new Error("Database connection/query failed: Query returned no results")
            );
            expect(heartbeat.status).toBe(PENDING);
        } finally {
            await container.stop();
        }
    });

    test("check() rejects when query returns multiple rows with conditions", async () => {
        const { container, connectionString } = await createAndStartMSSQLContainer();

        const mssqlMonitor = new MssqlMonitorType();
        const monitor = {
            databaseConnectionString: connectionString,
            databaseQuery: "SELECT 1 UNION ALL SELECT 2",
            conditions: JSON.stringify([
                {
                    type: "expression",
                    andOr: "and",
                    variable: "result",
                    operator: "equals",
                    value: "1",
                },
            ]),
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await expect(mssqlMonitor.check(monitor, heartbeat, {})).rejects.toEqual(
                new Error("Database connection/query failed: Multiple values were found, expected only one value")
            );
            expect(heartbeat.status).toBe(PENDING);
        } finally {
            await container.stop();
        }
    });

    test("check() rejects when query returns multiple columns with conditions", async () => {
        const { container, connectionString } = await createAndStartMSSQLContainer();

        const mssqlMonitor = new MssqlMonitorType();
        const monitor = {
            databaseConnectionString: connectionString,
            databaseQuery: "SELECT 1 AS col1, 2 AS col2",
            conditions: JSON.stringify([
                {
                    type: "expression",
                    andOr: "and",
                    variable: "result",
                    operator: "equals",
                    value: "1",
                },
            ]),
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await expect(mssqlMonitor.check(monitor, heartbeat, {})).rejects.toEqual(
                new Error("Database connection/query failed: Multiple columns were found, expected only one value")
            );
            expect(heartbeat.status).toBe(PENDING);
        } finally {
            await container.stop();
        }
    });
});
