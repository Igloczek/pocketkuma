// @ts-nocheck
"use strict";

import { ConditionVariable } from "./monitor-conditions/variables.ts";
import { defaultStringOperators } from "./monitor-conditions/operators.ts";

const CORE_MONITOR_TYPES = ["http", "keyword", "json-query", "ping", "push", "docker", "radius", "kafka-producer"];

const REMOVED_MONITOR_TYPES = [];

const optionalMonitorDefinitions = {
    "real-browser": {
        load: async () => new (await import("./monitor-types/real-browser-monitor-type.ts")).RealBrowserMonitorType(),
    },
    "tailscale-ping": {
        load: async () => new (await import("./monitor-types/tailscale-ping.ts")).TailscalePing(),
    },
    "websocket-upgrade": {
        load: async () => new (await import("./monitor-types/websocket-upgrade.ts")).WebSocketMonitorType(),
    },
    dns: {
        supportsConditions: true,
        conditionVariables: [new ConditionVariable("record", defaultStringOperators)],
        load: async () => new (await import("./monitor-types/dns.ts")).DnsMonitorType(),
    },
    postgres: {
        load: async () => new (await import("./monitor-types/postgres.ts")).PostgresMonitorType(),
    },
    mqtt: {
        supportsConditions: true,
        conditionVariables: [
            new ConditionVariable("message", defaultStringOperators),
            new ConditionVariable("topic", defaultStringOperators),
        ],
        load: async () => new (await import("./monitor-types/mqtt.ts")).MqttMonitorType(),
    },
    smtp: {
        load: async () => new (await import("./monitor-types/smtp.ts")).SMTPMonitorType(),
    },
    group: {
        allowCustomStatus: true,
        load: async () => new (await import("./monitor-types/group.ts")).GroupMonitorType(),
    },
    snmp: {
        load: async () => new (await import("./monitor-types/snmp.ts")).SNMPMonitorType(),
    },
    "grpc-keyword": {
        load: async () => new (await import("./monitor-types/grpc.ts")).GrpcKeywordMonitorType(),
    },
    mongodb: {
        load: async () => new (await import("./monitor-types/mongodb.ts")).MongodbMonitorType(),
    },
    rabbitmq: {
        load: async () => new (await import("./monitor-types/rabbitmq.ts")).RabbitMqMonitorType(),
    },
    "sip-options": {
        load: async () => new (await import("./monitor-types/sip-options.ts")).SIPMonitorType(),
    },
    gamedig: {
        load: async () => new (await import("./monitor-types/gamedig.ts")).GameDigMonitorType(),
    },
    steam: {
        load: async () => new (await import("./monitor-types/steam.ts")).SteamMonitorType(),
    },
    port: {
        load: async () => new (await import("./monitor-types/tcp.ts")).TCPMonitorType(),
    },
    manual: {
        allowCustomStatus: true,
        load: async () => new (await import("./monitor-types/manual.ts")).ManualMonitorType(),
    },
    globalping: {
        load: async (server) =>
            new (await import("./monitor-types/globalping.ts")).GlobalpingMonitorType(server.getUserAgent()),
    },
    redis: {
        load: async () => new (await import("./monitor-types/redis.ts")).RedisMonitorType(),
    },
    "system-service": {
        load: async () => new (await import("./monitor-types/system-service.ts")).SystemServiceMonitorType(),
    },
    sqlserver: {
        supportsConditions: true,
        conditionVariables: [new ConditionVariable("result", defaultStringOperators)],
        load: async () => new (await import("./monitor-types/mssql.ts")).MssqlMonitorType(),
    },
    mysql: {
        supportsConditions: true,
        conditionVariables: [new ConditionVariable("result", defaultStringOperators)],
        load: async () => new (await import("./monitor-types/mysql.ts")).MysqlMonitorType(),
    },
    oracledb: {
        supportsConditions: true,
        conditionVariables: [new ConditionVariable("result", defaultStringOperators)],
        load: async () => new (await import("./monitor-types/oracledb.ts")).OracleDbMonitorType(),
    },
};

const OPTIONAL_MONITOR_TYPES = Object.keys(optionalMonitorDefinitions);
const loadedMonitorTypes = {};
const loadingMonitorTypes = {};

function createMonitorTypeList() {
    return Object.fromEntries(
        Object.entries(optionalMonitorDefinitions).map(([name, definition]) => [
            name,
            {
                supportsConditions: Boolean(definition.supportsConditions),
                conditionVariables: definition.conditionVariables || [],
                allowCustomStatus: Boolean(definition.allowCustomStatus),
            },
        ])
    );
}

async function getMonitorType(name, server) {
    const definition = optionalMonitorDefinitions[name];
    if (!definition) {
        return null;
    }

    if (loadedMonitorTypes[name]) {
        return loadedMonitorTypes[name];
    }

    if (!loadingMonitorTypes[name]) {
        loadingMonitorTypes[name] = definition
            .load(server)
            .then((instance) => {
                loadedMonitorTypes[name] = instance;
                return instance;
            })
            .finally(() => {
                if (!loadedMonitorTypes[name]) {
                    delete loadingMonitorTypes[name];
                }
            });
    }

    return await loadingMonitorTypes[name];
}

function getLoadedMonitorTypes() {
    return Object.keys(loadedMonitorTypes);
}

export {
    CORE_MONITOR_TYPES,
    OPTIONAL_MONITOR_TYPES,
    REMOVED_MONITOR_TYPES,
    createMonitorTypeList,
    getLoadedMonitorTypes,
    getMonitorType,
};
