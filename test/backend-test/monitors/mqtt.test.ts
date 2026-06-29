// @ts-nocheck

/**
 * Runs an MQTT test with the
 * @param  {string} mqttSuccessMessage the message that the monitor expects
 * @param {null|"keyword"|"json-query"} mqttCheckType the type of check we perform
 * @param {string} receivedMessage what message is received from the mqtt channel
 * @param {string} monitorTopic which MQTT topic is monitored (wildcards are allowed)
 * @param {string} publishTopic to which MQTT topic the message is sent
 * @param {string|null} conditions JSON string of conditions or null
 * @returns {Promise<Heartbeat>} the heartbeat produced by the check
 */
import { describe, test, expect } from "bun:test";
import { HiveMQContainer } from "@testcontainers/hivemq";
import mqtt from "mqtt";
import { MqttMonitorType } from "../../../src/server/monitor-types/mqtt.ts";
import { UP, PENDING } from "../../../src/util.ts";

// HiveMQ Testcontainers startup can exceed Bun's default 5s per-test timeout.
const MQTT_TEST_TIMEOUT_MS = 120_000;

function mqttTest(name, fn) {
    test(name, { timeout: MQTT_TEST_TIMEOUT_MS }, fn);
}

async function testMqtt(
    mqttSuccessMessage,
    mqttCheckType,
    receivedMessage,
    monitorTopic = "test",
    publishTopic = "test",
    conditions = null
) {
    const hiveMQContainer = await new HiveMQContainer().start();
    const connectionString = hiveMQContainer.getConnectionString();
    const mqttMonitorType = new MqttMonitorType();
    const monitor = {
        jsonPath: "firstProp", // always return firstProp for the json-query monitor
        hostname: connectionString.split(":", 2).join(":"),
        mqttTopic: monitorTopic,
        port: connectionString.split(":")[2],
        mqttUsername: null,
        mqttPassword: null,
        mqttWebsocketPath: null, // for WebSocket connections
        interval: 20, // controls the timeout
        mqttSuccessMessage: mqttSuccessMessage, // for keywords
        expectedValue: mqttSuccessMessage, // for json-query
        mqttCheckType: mqttCheckType,
        conditions: conditions, // for conditions system
    };
    const heartbeat = {
        msg: "",
        status: PENDING,
    };

    const testMqttClient = mqtt.connect(hiveMQContainer.getConnectionString());
    testMqttClient.on("connect", () => {
        testMqttClient.subscribe(monitorTopic, (error) => {
            if (!error) {
                testMqttClient.publish(publishTopic, receivedMessage);
            }
        });
    });

    try {
        await mqttMonitorType.check(monitor, heartbeat);
    } finally {
        testMqttClient.end();
        hiveMQContainer.stop();
    }
    return heartbeat;
}

describe.skipIf(!!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"))("MqttMonitorType", () => {
    mqttTest("check() sets status to UP when keyword is found in message (type=default)", async () => {
        const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-");
        expect(heartbeat.status).toBe(UP);
        expect(heartbeat.msg).toBe("Topic: test; Message: -> KEYWORD <-");
    });

    mqttTest("check() sets status to UP when keyword is found in nested topic", async () => {
        const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-", "a/b/c", "a/b/c");
        expect(heartbeat.status).toBe(UP);
        expect(heartbeat.msg).toBe("Topic: a/b/c; Message: -> KEYWORD <-");
    });

    mqttTest("check() sets status to UP when keyword is found in nested topic with special characters", async () => {
        const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-", "a/'/$/./*/%", "a/'/$/./*/%");
        expect(heartbeat.status).toBe(UP);
        expect(heartbeat.msg).toBe("Topic: a/'/$/./*/%; Message: -> KEYWORD <-");
    });

    mqttTest("check() sets status to UP when keyword is found using # wildcard", async () => {
        const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-", "a/#", "a/b/c");
        expect(heartbeat.status).toBe(UP);
        expect(heartbeat.msg).toBe("Topic: a/b/c; Message: -> KEYWORD <-");
    });

    mqttTest("check() sets status to UP when keyword is found using + wildcard", async () => {
        const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-", "a/+/c", "a/b/c");
        expect(heartbeat.status).toBe(UP);
        expect(heartbeat.msg).toBe("Topic: a/b/c; Message: -> KEYWORD <-");
    });

    mqttTest("check() sets status to UP when keyword is found using + and # wildcards", async () => {
        const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-", "a/+/c/#", "a/b/c/d/e");
        expect(heartbeat.status).toBe(UP);
        expect(heartbeat.msg).toBe("Topic: a/b/c/d/e; Message: -> KEYWORD <-");
    });

    mqttTest("check() rejects with timeout when topic does not match", async () => {
        await expect(testMqtt("keyword will not be checked anyway", null, "message", "x/y/z", "a/b/c")).rejects.toEqual(
            new Error("Timeout, Message not received")
        );
    });

    mqttTest("check() rejects with timeout when # wildcard is not last character", async () => {
        await expect(testMqtt("", null, "# should be last character", "#/c", "a/b/c")).rejects.toEqual(
            new Error("Timeout, Message not received")
        );
    });

    mqttTest("check() rejects with timeout when + wildcard topic does not match", async () => {
        await expect(testMqtt("", null, "message", "x/+/z", "a/b/c")).rejects.toEqual(
            new Error("Timeout, Message not received")
        );
    });

    mqttTest("check() sets status to UP when keyword is found in message (type=keyword)", async () => {
        const heartbeat = await testMqtt("KEYWORD", "keyword", "-> KEYWORD <-");
        expect(heartbeat.status).toBe(UP);
        expect(heartbeat.msg).toBe("Topic: test; Message: -> KEYWORD <-");
    });

    mqttTest("check() rejects when keyword is not found in message (type=default)", async () => {
        await expect(testMqtt("NOT_PRESENT", null, "-> KEYWORD <-")).rejects.toEqual(
            new Error("Message Mismatch - Topic: test; Message: -> KEYWORD <-")
        );
    });

    mqttTest("check() rejects when keyword is not found in message (type=keyword)", async () => {
        await expect(testMqtt("NOT_PRESENT", "keyword", "-> KEYWORD <-")).rejects.toEqual(
            new Error("Message Mismatch - Topic: test; Message: -> KEYWORD <-")
        );
    });

    mqttTest("check() sets status to UP when json-query finds expected value", async () => {
        // works because the monitors' jsonPath is hard-coded to "firstProp"
        const heartbeat = await testMqtt("present", "json-query", '{"firstProp":"present"}');
        expect(heartbeat.status).toBe(UP);
        expect(heartbeat.msg).toBe("Message received, expected value is found");
    });

    mqttTest("check() rejects when json-query path returns undefined", async () => {
        // works because the monitors' jsonPath is hard-coded to "firstProp"
        await expect(testMqtt("[not_relevant]", "json-query", "{}")).rejects.toEqual(
            new Error("Message received but value is not equal to expected value, value was: [undefined]")
        );
    });

    mqttTest("check() rejects when json-query value does not match expected value", async () => {
        // works because the monitors' jsonPath is hard-coded to "firstProp"
        await expect(testMqtt("[wrong_success_messsage]", "json-query", '{"firstProp":"present"}')).rejects.toEqual(
            new Error("Message received but value is not equal to expected value, value was: [present]")
        );
    });

    // Conditions system tests
    mqttTest("check() sets status to UP when message condition matches (contains)", async () => {
        const conditions = JSON.stringify([
            {
                type: "expression",
                variable: "message",
                operator: "contains",
                value: "KEYWORD",
            },
        ]);
        const heartbeat = await testMqtt("", null, "-> KEYWORD <-", "test", "test", conditions);
        expect(heartbeat.status).toBe(UP);
        expect(heartbeat.msg).toBe("Topic: test; Message: -> KEYWORD <-");
    });

    mqttTest("check() sets status to UP when topic condition matches (equals)", async () => {
        const conditions = JSON.stringify([
            {
                type: "expression",
                variable: "topic",
                operator: "equals",
                value: "sensors/temp",
            },
        ]);
        const heartbeat = await testMqtt("", null, "any message", "sensors/temp", "sensors/temp", conditions);
        expect(heartbeat.status).toBe(UP);
    });

    mqttTest("check() rejects when message condition does not match", async () => {
        const conditions = JSON.stringify([
            {
                type: "expression",
                variable: "message",
                operator: "contains",
                value: "EXPECTED",
            },
        ]);
        await expect(testMqtt("", null, "actual message without keyword", "test", "test", conditions)).rejects.toEqual(
            new Error("Conditions not met - Topic: test; Message: actual message without keyword")
        );
    });

    mqttTest("check() sets status to UP with multiple conditions (AND)", async () => {
        const conditions = JSON.stringify([
            {
                type: "expression",
                variable: "topic",
                operator: "equals",
                value: "test",
            },
            {
                type: "expression",
                variable: "message",
                operator: "contains",
                value: "success",
                andOr: "and",
            },
        ]);
        const heartbeat = await testMqtt("", null, "operation success", "test", "test", conditions);
        expect(heartbeat.status).toBe(UP);
    });
});
