// @ts-nocheck

import { MonitorType } from "@/server/monitor-types/monitor-type";
import { UP } from "@/util";
import redis from "redis";

class RedisMonitorType extends MonitorType {
    name = "redis";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        heartbeat.msg = await this.redisPingAsync(
            monitor.databaseConnectionString,
            !monitor.ignoreTls,
            (monitor.timeout ?? 20) * 1000
        );
        heartbeat.status = UP;
    }

    /**
     * Redis server ping
     * @param {string} dsn The redis connection string
     * @param {boolean} rejectUnauthorized If false, allows unverified server certificates.
     * @param {number} timeout Connection and command timeout in milliseconds
     * @returns {Promise<any>} Response from redis server
     */
    async redisPingAsync(dsn, rejectUnauthorized, timeout) {
        const client = redis.createClient({
            url: dsn,
            socket: {
                rejectUnauthorized,
                connectTimeout: timeout,
                socketTimeout: timeout,
                reconnectStrategy: false,
            },
            commandOptions: {
                abortSignal: AbortSignal.timeout(timeout),
            },
        });
        client.on("error", () => {});
        try {
            await client.connect();
            return await client.ping();
        } finally {
            if (client.isOpen) {
                client.destroy();
            }
        }
    }
}

export { RedisMonitorType };
