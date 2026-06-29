// @ts-nocheck
"use strict";

import { ConditionVariable } from "@/server/monitor-conditions/variables";
import { defaultStringOperators } from "@/server/monitor-conditions/operators";

const CORE_MONITOR_TYPES = ["http", "keyword", "json-query", "ping", "push", "docker", "radius", "kafka-producer"];

const REMOVED_MONITOR_TYPES = [];

const optionalMonitorDefinitions = {
    "real-browser": {
        load: async () =>
            new (await import("@/server/monitor-types/real-browser-monitor-type")).RealBrowserMonitorType(),
    },
    "tailscale-ping": {
        load: async () => new (await import("@/server/monitor-types/tailscale-ping")).TailscalePing(),
    },
    "websocket-upgrade": {
        load: async () => new (await import("@/server/monitor-types/websocket-upgrade")).WebSocketMonitorType(),
    },
    dns: {
        supportsConditions: true,
        conditionVariables: [new ConditionVariable("record", defaultStringOperators)],
        load: async () => new (await import("@/server/monitor-types/dns")).DnsMonitorType(),
    },
    postgres: {
        load: async () => new (await import("@/server/monitor-types/postgres")).PostgresMonitorType(),
    },
    mqtt: {
        supportsConditions: true,
        conditionVariables: [
            new ConditionVariable("message", defaultStringOperators),
            new ConditionVariable("topic", defaultStringOperators),
        ],
        load: async () => new (await import("@/server/monitor-types/mqtt")).MqttMonitorType(),
    },
    smtp: {
        load: async () => new (await import("@/server/monitor-types/smtp")).SMTPMonitorType(),
    },
    group: {
        allowCustomStatus: true,
        load: async () => new (await import("@/server/monitor-types/group")).GroupMonitorType(),
    },
    snmp: {
        load: async () => new (await import("@/server/monitor-types/snmp")).SNMPMonitorType(),
    },
    "grpc-keyword": {
        load: async () => new (await import("@/server/monitor-types/grpc")).GrpcKeywordMonitorType(),
    },
    mongodb: {
        load: async () => new (await import("@/server/monitor-types/mongodb")).MongodbMonitorType(),
    },
    rabbitmq: {
        load: async () => new (await import("@/server/monitor-types/rabbitmq")).RabbitMqMonitorType(),
    },
    "sip-options": {
        load: async () => new (await import("@/server/monitor-types/sip-options")).SIPMonitorType(),
    },
    gamedig: {
        load: async () => new (await import("@/server/monitor-types/gamedig")).GameDigMonitorType(),
    },
    steam: {
        load: async () => new (await import("@/server/monitor-types/steam")).SteamMonitorType(),
    },
    port: {
        load: async () => new (await import("@/server/monitor-types/tcp")).TCPMonitorType(),
    },
    manual: {
        allowCustomStatus: true,
        load: async () => new (await import("@/server/monitor-types/manual")).ManualMonitorType(),
    },
    globalping: {
        load: async (server) =>
            new (await import("@/server/monitor-types/globalping")).GlobalpingMonitorType(server.getUserAgent()),
    },
    redis: {
        load: async () => new (await import("@/server/monitor-types/redis")).RedisMonitorType(),
    },
    "system-service": {
        load: async () => new (await import("@/server/monitor-types/system-service")).SystemServiceMonitorType(),
    },
    sqlserver: {
        supportsConditions: true,
        conditionVariables: [new ConditionVariable("result", defaultStringOperators)],
        load: async () => new (await import("@/server/monitor-types/mssql")).MssqlMonitorType(),
    },
    mysql: {
        supportsConditions: true,
        conditionVariables: [new ConditionVariable("result", defaultStringOperators)],
        load: async () => new (await import("@/server/monitor-types/mysql")).MysqlMonitorType(),
    },
    oracledb: {
        supportsConditions: true,
        conditionVariables: [new ConditionVariable("result", defaultStringOperators)],
        load: async () => new (await import("@/server/monitor-types/oracledb")).OracleDbMonitorType(),
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
