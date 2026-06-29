// @ts-nocheck

/**
 * Helper function to create and start a MySQL container
 * @returns {Promise<{container: MySqlContainer, connectionString: string}>} The started container and connection string
 */
import { describe, test } from "node:test";
import assert from "node:assert";
import { MySqlContainer } from "@testcontainers/mysql";
import { MysqlMonitorType } from "../../../src/server/monitor-types/mysql.ts";
import { UP, PENDING } from "../../../src/util.ts";

async function createAndStartMySQLContainer() {
    const container = await new MySqlContainer("mysql:8.0").withStartupTimeout(120000).start();

    const connectionString = `mysql://${container.getUsername()}:${container.getUserPassword()}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;

    return {
        container,
        connectionString,
    };
}

describe(
    "MySQL Monitor",
    {
        skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
    },
    () => {
        test("check() sets status to UP when MySQL server is reachable", async () => {
            const { container, connectionString } = await createAndStartMySQLContainer();

            const mysqlMonitor = new MysqlMonitorType();
            const monitor = {
                databaseConnectionString: connectionString,
                conditions: "[]",
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await mysqlMonitor.check(monitor, heartbeat, {});
                assert.strictEqual(heartbeat.status, UP, `Expected status ${UP} but got ${heartbeat.status}`);
            } finally {
                await container.stop();
            }
        });

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

            await assert.rejects(mysqlMonitor.check(monitor, heartbeat, {}), (err) => {
                assert.ok(
                    err.message.includes("Database connection/query failed"),
                    `Expected error message to include "Database connection/query failed" but got: ${err.message}`
                );
                return true;
            });
            assert.notStrictEqual(heartbeat.status, UP, `Expected status should not be ${UP}`);
        });

        test("check() sets status to UP when custom query result meets condition", async () => {
            const { container, connectionString } = await createAndStartMySQLContainer();

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

            try {
                await mysqlMonitor.check(monitor, heartbeat, {});
                assert.strictEqual(heartbeat.status, UP, `Expected status ${UP} but got ${heartbeat.status}`);
            } finally {
                await container.stop();
            }
        });

        test("check() rejects when custom query result does not meet condition", async () => {
            const { container, connectionString } = await createAndStartMySQLContainer();

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

            try {
                await assert.rejects(
                    mysqlMonitor.check(monitor, heartbeat, {}),
                    new Error("Query result did not meet the specified conditions (99)")
                );
                assert.strictEqual(heartbeat.status, PENDING, `Expected status should not be ${heartbeat.status}`);
            } finally {
                await container.stop();
            }
        });
    }
);
