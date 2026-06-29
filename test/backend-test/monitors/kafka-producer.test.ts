// @ts-nocheck

import { describe, test } from "node:test";
import assert from "node:assert";
import { kafkaProducerAsync } from "../../../src/server/util-server.ts";

describe("Kafka Producer", () => {
    test("rejects when broker is not reachable", async () => {
        await assert.rejects(
            kafkaProducerAsync(["localhost:19092"], "test-topic", "test-message", {
                interval: 5,
                connectionTimeout: 1,
            }),
            /.*/ // any error
        );
    });
});
