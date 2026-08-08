// @ts-nocheck

/**
 * Helper function to create and start a MySQL container
 * @returns {Promise<{container: MySqlContainer, connectionString: string}>} The started container and connection string
 */
import { describe, test, expect, beforeAll, afterAll, setDefaultTimeout } from "bun:test";
import { MySqlContainer } from "@testcontainers/mysql";
import { MysqlMonitorType } from "@/server/monitor-types/mysql";
import { UP, PENDING } from "@/constants";

setDefaultTimeout(120_000);

async function createAndStartMySQLContainer() {
    const container = await new MySqlContainer("mysql:8.0").withStartupTimeout(120000).start();

    const connectionString = `mysql://${container.getUsername()}:${container.getUserPassword()}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;

    return {
        container,
        connectionString,
    };
}

describe.skipIf(!!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"))("MySQL Monitor", () => {
    let container;
    let connectionString;

    beforeAll(async () => {
        const mysql = await createAndStartMySQLContainer();
        container = mysql.container;
        connectionString = mysql.connectionString;
    });

    afterAll(async () => {
        await container?.stop();
    });

    test("check() sets status to UP when MySQL server is reachable", async () => {
        const mysqlMonitor = new MysqlMonitorType();
        const monitor = {
            databaseConnectionString: connectionString,
            conditions: "[]",
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await mysqlMonitor.check(monitor, heartbeat, {});
        expect(heartbeat.status).toBe(UP);
    }, 30_000);

    test("check() rejects when MySQL server is not reachable", async () => {
        const mysqlMonitor = new MysqlMonitorType();
        const monitor = {
            databaseConnectionString: "mysql://invalid:invalid@localhost:13306/test",
            conditions: "[]",
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await expect(mysqlMonitor.check(monitor, heartbeat, {})).rejects.toThrow("Database connection/query failed");
        expect(heartbeat.status).not.toBe(UP);
    }, 30_000);

    test("check() sets status to UP when custom query result meets condition", async () => {
        const mysqlMonitor = new MysqlMonitorType();
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

        await mysqlMonitor.check(monitor, heartbeat, {});
        expect(heartbeat.status).toBe(UP);
    }, 30_000);

    test("check() rejects when custom query result does not meet condition", async () => {
        const mysqlMonitor = new MysqlMonitorType();
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

        await expect(mysqlMonitor.check(monitor, heartbeat, {})).rejects.toEqual(
            new Error("Query result did not meet the specified conditions (99)")
        );
        expect(heartbeat.status).toBe(PENDING);
    }, 30_000);
});
