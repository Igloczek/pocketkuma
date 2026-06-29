// @ts-nocheck

import { describe, test, expect } from "bun:test";
import { kafkaProducerAsync } from "../../../src/server/util-server.ts";

describe("Kafka Producer", () => {
    test("rejects when broker is not reachable", async () => {
        await expect(
            kafkaProducerAsync(["localhost:19092"], "test-topic", "test-message", {
                interval: 5,
                connectionTimeout: 1,
            })
        ).rejects.toThrow(/.*/);
    });
});
