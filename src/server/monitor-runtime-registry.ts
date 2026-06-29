// @ts-nocheck
"use strict";

const { ConditionVariable } = require("./monitor-conditions/variables");
const { defaultStringOperators } = require("./monitor-conditions/operators");

const CORE_MONITOR_TYPES = ["http", "keyword", "json-query", "ping", "push", "docker", "radius", "kafka-producer"];

const REMOVED_MONITOR_TYPES = [];

const optionalMonitorDefinitions = {
    "real-browser": {
        load: () => new (require("./monitor-types/real-browser-monitor-type").RealBrowserMonitorType)(),
    },
    "tailscale-ping": {
        load: () => new (require("./monitor-types/tailscale-ping").TailscalePing)(),
    },
    "websocket-upgrade": {
        load: () => new (require("./monitor-types/websocket-upgrade").WebSocketMonitorType)(),
    },
    dns: {
        supportsConditions: true,
        conditionVariables: [new ConditionVariable("record", defaultStringOperators)],
        load: () => new (require("./monitor-types/dns").DnsMonitorType)(),
    },
    postgres: {
        load: () => new (require("./monitor-types/postgres").PostgresMonitorType)(),
    },
    mqtt: {
        supportsConditions: true,
        conditionVariables: [
            new ConditionVariable("message", defaultStringOperators),
            new ConditionVariable("topic", defaultStringOperators),
        ],
        load: () => new (require("./monitor-types/mqtt").MqttMonitorType)(),
    },
    smtp: {
        load: () => new (require("./monitor-types/smtp").SMTPMonitorType)(),
    },
    group: {
        allowCustomStatus: true,
        load: () => new (require("./monitor-types/group").GroupMonitorType)(),
    },
    snmp: {
        load: () => new (require("./monitor-types/snmp").SNMPMonitorType)(),
    },
    "grpc-keyword": {
        load: () => new (require("./monitor-types/grpc").GrpcKeywordMonitorType)(),
    },
    mongodb: {
        load: () => new (require("./monitor-types/mongodb").MongodbMonitorType)(),
    },
    rabbitmq: {
        load: () => new (require("./monitor-types/rabbitmq").RabbitMqMonitorType)(),
    },
    "sip-options": {
        load: () => new (require("./monitor-types/sip-options").SIPMonitorType)(),
    },
    gamedig: {
        load: () => new (require("./monitor-types/gamedig").GameDigMonitorType)(),
    },
    steam: {
        load: () => new (require("./monitor-types/steam").SteamMonitorType)(),
    },
    port: {
        load: () => new (require("./monitor-types/tcp").TCPMonitorType)(),
    },
    manual: {
        allowCustomStatus: true,
        load: () => new (require("./monitor-types/manual").ManualMonitorType)(),
    },
    globalping: {
        load: (server) => new (require("./monitor-types/globalping").GlobalpingMonitorType)(server.getUserAgent()),
    },
    redis: {
        load: () => new (require("./monitor-types/redis").RedisMonitorType)(),
    },
    "system-service": {
        load: () => new (require("./monitor-types/system-service").SystemServiceMonitorType)(),
    },
    sqlserver: {
        supportsConditions: true,
        conditionVariables: [new ConditionVariable("result", defaultStringOperators)],
        load: () => new (require("./monitor-types/mssql").MssqlMonitorType)(),
    },
    mysql: {
        supportsConditions: true,
        conditionVariables: [new ConditionVariable("result", defaultStringOperators)],
        load: () => new (require("./monitor-types/mysql").MysqlMonitorType)(),
    },
    oracledb: {
        supportsConditions: true,
        conditionVariables: [new ConditionVariable("result", defaultStringOperators)],
        load: () => new (require("./monitor-types/oracledb").OracleDbMonitorType)(),
    },
};

const OPTIONAL_MONITOR_TYPES = Object.keys(optionalMonitorDefinitions);
const loadedMonitorTypes = {};

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

    if (!loadedMonitorTypes[name]) {
        loadedMonitorTypes[name] = definition.load(server);
    }

    return loadedMonitorTypes[name];
}

function getLoadedMonitorTypes() {
    return Object.keys(loadedMonitorTypes);
}

module.exports = {
    CORE_MONITOR_TYPES,
    OPTIONAL_MONITOR_TYPES,
    REMOVED_MONITOR_TYPES,
    createMonitorTypeList,
    getLoadedMonitorTypes,
    getMonitorType,
};
