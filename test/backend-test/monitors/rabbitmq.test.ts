// @ts-nocheck

import { describe, test, expect } from "bun:test";
import { RabbitMQContainer } from "@testcontainers/rabbitmq";
import { RabbitMqMonitorType } from "../../../src/server/monitor-types/rabbitmq.ts";
import { UP, PENDING } from "../../../src/util.ts";

describe.skipIf(!!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"))(
    "RabbitMQ Single Node",
    () => {
        test("check() sets status to UP when RabbitMQ server is reachable", async () => {
            // The default timeout of 30 seconds might not be enough for the container to start
            const rabbitMQContainer = await new RabbitMQContainer().withStartupTimeout(60000).start();
            const rabbitMQMonitor = new RabbitMqMonitorType();
            const connectionString = `http://${rabbitMQContainer.getHost()}:${rabbitMQContainer.getMappedPort(15672)}`;

            const monitor = {
                rabbitmqNodes: JSON.stringify([connectionString]),
                rabbitmqUsername: "guest",
                rabbitmqPassword: "guest",
                timeout: 10,
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await rabbitMQMonitor.check(monitor, heartbeat);
                expect(heartbeat.status).toBe(UP);
                expect(heartbeat.msg).toBe("Node is reachable and there are no alerts in the cluster");
            } finally {
                rabbitMQContainer.stop();
            }
        });

        test("check() rejects when RabbitMQ server is not reachable", async () => {
            const rabbitMQMonitor = new RabbitMqMonitorType();
            const monitor = {
                rabbitmqNodes: JSON.stringify(["http://localhost:15672"]),
                rabbitmqUsername: "rabbitmqUser",
                rabbitmqPassword: "rabbitmqPass",
                timeout: 10,
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            // regex match any string
            const regex = /.+/;

            await expect(rabbitMQMonitor.check(monitor, heartbeat)).rejects.toThrow(regex);
        });

        test("checkSingleNode() succeeds when node is healthy", async () => {
            const rabbitMQContainer = await new RabbitMQContainer().withStartupTimeout(60000).start();
            const rabbitMQMonitor = new RabbitMqMonitorType();
            const connectionString = `http://${rabbitMQContainer.getHost()}:${rabbitMQContainer.getMappedPort(15672)}`;

            const monitor = {
                name: "Test Monitor",
                rabbitmqUsername: "guest",
                rabbitmqPassword: "guest",
                timeout: 10,
            };

            try {
                // Should not throw - just validates the node is healthy
                await rabbitMQMonitor.checkSingleNode(monitor, connectionString, "1/1");
            } finally {
                rabbitMQContainer.stop();
            }
        });

        test("checkSingleNode() throws error when node is unreachable", async () => {
            const rabbitMQMonitor = new RabbitMqMonitorType();
            const monitor = {
                name: "Test Monitor",
                rabbitmqUsername: "guest",
                rabbitmqPassword: "guest",
                timeout: 10,
            };

            // Should reject with any error (connection refused, timeout, etc.)
            await expect(rabbitMQMonitor.checkSingleNode(monitor, "http://localhost:15672", "1/1")).rejects.toThrow(
                Error
            );
        });
    }
);

describe("RabbitMQ Multi-Node (Mocked)", () => {
    test("check() succeeds when first node is healthy", async () => {
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const monitor = {
            rabbitmqNodes: JSON.stringify(["http://node1:15672", "http://node2:15672"]),
            rabbitmqUsername: "guest",
            rabbitmqPassword: "guest",
            timeout: 10,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        // Mock checkSingleNode to succeed on first call (just don't throw)
        let callCount = 0;
        rabbitMQMonitor.checkSingleNode = async (mon, url, nodeInfo) => {
            callCount++;
            // Success - don't throw
        };

        await rabbitMQMonitor.check(monitor, heartbeat);
        expect(heartbeat.status).toBe(UP);
        expect(heartbeat.msg).toBe("One of the 2 nodes is reachable and there are no alerts in the cluster");
        expect(callCount).toBe(1); // Should only check first node;
    });

    test("check() succeeds when second node is healthy after first fails", async () => {
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const monitor = {
            rabbitmqNodes: JSON.stringify(["http://node1:15672", "http://node2:15672"]),
            rabbitmqUsername: "guest",
            rabbitmqPassword: "guest",
            timeout: 10,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        // Mock checkSingleNode to fail first, succeed second
        let callCount = 0;
        rabbitMQMonitor.checkSingleNode = async (mon, url, nodeInfo) => {
            callCount++;
            if (callCount === 1) {
                throw new Error("Node 1 connection failed");
            }
            // Second call succeeds - don't throw
        };

        await rabbitMQMonitor.check(monitor, heartbeat);
        expect(heartbeat.status).toBe(UP);
        expect(heartbeat.msg).toBe("One of the 2 nodes is reachable and there are no alerts in the cluster");
        expect(callCount).toBe(2); // Should check both nodes;
    });

    test("check() fails with consolidated error when all nodes are down", async () => {
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const monitor = {
            rabbitmqNodes: JSON.stringify(["http://node1:15672", "http://node2:15672", "http://node3:15672"]),
            rabbitmqUsername: "guest",
            rabbitmqPassword: "guest",
            timeout: 10,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        // Mock checkSingleNode to always fail
        let callCount = 0;
        rabbitMQMonitor.checkSingleNode = async (mon, url, nodeInfo) => {
            callCount++;
            throw new Error(`Connection failed to node ${callCount}`);
        };

        try {
            await rabbitMQMonitor.check(monitor, heartbeat);
            expect.unreachable();
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            expect(msg).toMatch(/All 3 nodes failed/);
            expect(msg).toMatch(/Node 1:/);
            expect(msg).toMatch(/Node 2:/);
            expect(msg).toMatch(/Node 3:/);
        }
        expect(callCount).toBe(3); // Should check all three nodes;
    });

    test("check() fails when no nodes are configured", async () => {
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const monitor = {
            rabbitmqNodes: JSON.stringify([]),
            rabbitmqUsername: "guest",
            rabbitmqPassword: "guest",
            timeout: 10,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await expect(rabbitMQMonitor.check(monitor, heartbeat)).rejects.toThrow(/No RabbitMQ nodes configured/);
    });

    test("check() tries all nodes before failing", async () => {
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const monitor = {
            rabbitmqNodes: JSON.stringify([
                "http://node1:15672",
                "http://node2:15672",
                "http://node3:15672",
                "http://node4:15672",
            ]),
            rabbitmqUsername: "guest",
            rabbitmqPassword: "guest",
            timeout: 10,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        const checkedNodes = [];
        rabbitMQMonitor.checkSingleNode = async (mon, url, nodeInfo) => {
            checkedNodes.push(url);
            throw new Error(`Failed: ${url}`);
        };

        await expect(rabbitMQMonitor.check(monitor, heartbeat)).rejects.toThrow(/All 4 nodes failed/);

        expect(checkedNodes.length).toBe(4); // Should check all 4 nodes;
        expect(checkedNodes[0]).toEqual("http://node1:15672");
        expect(checkedNodes[1]).toEqual("http://node2:15672");
        expect(checkedNodes[2]).toEqual("http://node3:15672");
        expect(checkedNodes[3]).toEqual("http://node4:15672");
    });
});
