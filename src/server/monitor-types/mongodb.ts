// @ts-nocheck

import { MonitorType } from "@/server/monitor-types/monitor-type";
import { UP } from "@/constants";
import { MongoClient } from "mongodb";
import { evaluateJsonata } from "@/server/json-query";

class MongodbMonitorType extends MonitorType {
    name = "mongodb";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let command = { ping: 1 };
        if (monitor.databaseQuery) {
            command = JSON.parse(monitor.databaseQuery);
        }

        let result = await this.runMongodbCommand(
            monitor.databaseConnectionString,
            command,
            (monitor.timeout ?? 20) * 1000
        );

        if (result["ok"] !== 1) {
            throw new Error("MongoDB command failed");
        } else {
            heartbeat.msg = "Command executed successfully";
        }

        if (monitor.jsonPath) {
            result = await evaluateJsonata(monitor.jsonPath, result);
            if (result) {
                heartbeat.msg = "Command executed successfully and the jsonata expression produces a result.";
            } else {
                throw new Error("Queried value not found.");
            }
        }

        if (monitor.expectedValue) {
            if (result.toString() === monitor.expectedValue) {
                heartbeat.msg = "Command executed successfully and expected value was found";
            } else {
                throw new Error(
                    "Query executed, but value is not equal to expected value, value was: [" +
                        JSON.stringify(result) +
                        "]"
                );
            }
        }

        heartbeat.status = UP;
    }

    /**
     * Connect to and run MongoDB command on a MongoDB database
     * @param {string} connectionString The database connection string
     * @param {object} command MongoDB command to run on the database
     * @param {number} timeout Connection and command timeout in milliseconds
     * @returns {Promise<(string[] | object[] | object)>} Response from server
     */
    async runMongodbCommand(connectionString, command, timeout) {
        const deadline = Date.now() + timeout;
        const client = new MongoClient(connectionString, {
            connectTimeoutMS: timeout,
            serverSelectionTimeoutMS: timeout,
            socketTimeoutMS: timeout,
        });
        try {
            await client.connect();
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                throw new Error("MongoDB monitor timed out");
            }
            return await client.db().command(command, {
                maxTimeMS: remaining,
                socketTimeoutMS: remaining,
            });
        } finally {
            await client.close();
        }
    }
}

export { MongodbMonitorType };
