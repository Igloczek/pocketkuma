// @ts-nocheck

import { beforeAll, describe, expect, test } from "bun:test";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { GrpcKeywordMonitorType } from "@/server/monitor-types/grpc";
import { PostgresMonitorType } from "@/server/monitor-types/postgres";

let Monitor;

beforeAll(async () => {
    await import("@/server/bun-sqlite-store");
    Monitor = (await import("@/server/model/monitor")).default;
});

const testProto = `
syntax = "proto3";
package test;
service TestService { rpc Echo (EchoRequest) returns (EchoResponse); }
message EchoRequest { string message = 1; }
message EchoResponse { string message = 1; }
`;

function deferred() {
    let resolve;
    const promise = new Promise((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

async function settleWithin(promise, timeoutMs) {
    let timer;
    try {
        return await Promise.race([
            promise.then(() => true),
            new Promise((resolve) => {
                timer = setTimeout(() => resolve(false), timeoutMs);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

async function createHangingGrpcServer() {
    const protoPath = path.join(os.tmpdir(), `pocketkuma-timeout-${process.pid}-${Date.now()}.proto`);
    fs.writeFileSync(protoPath, testProto);
    const packageDefinition = protoLoader.loadSync(protoPath);
    const descriptor = grpc.loadPackageDefinition(packageDefinition);
    const requestArrived = deferred();
    const requestCanceled = deferred();
    const server = new grpc.Server();
    server.addService(descriptor.test.TestService.service, {
        Echo(call) {
            requestArrived.resolve();
            call.on("cancelled", requestCanceled.resolve);
        },
    });
    const port = await new Promise((resolve, reject) => {
        server.bindAsync("127.0.0.1:0", grpc.ServerCredentials.createInsecure(), (error, assignedPort) =>
            error ? reject(error) : resolve(assignedPort)
        );
    });
    server.start();
    fs.rmSync(protoPath, { force: true });
    return { port, requestArrived, requestCanceled, server };
}

describe("monitor provider timeout cleanup", () => {
    test("gRPC stop enforces monitor timeout and cancels the active call", async () => {
        const fixture = await createHangingGrpcServer();
        const monitor = new Monitor();
        Object.assign(monitor, {
            timeout: 0.05,
            grpcUrl: `127.0.0.1:${fixture.port}`,
            grpcProtobuf: testProto,
            grpcServiceName: "test.TestService",
            grpcMethod: "echo",
            grpcBody: JSON.stringify({ message: "test" }),
            keyword: "SUCCESS",
            grpcEnableTls: false,
            isInvertKeyword: () => false,
        });
        const result = new GrpcKeywordMonitorType().check(monitor, {}).catch((error) => error);
        monitor.activeHeartbeat = result.then(() => {});
        await fixture.requestArrived.promise;

        const stopping = monitor.stop();
        const stoppedByDeadline = await settleWithin(stopping, 250);
        if (!stoppedByDeadline) {
            fixture.server.forceShutdown();
        }
        await stopping;

        try {
            expect(stoppedByDeadline).toBe(true);
            expect(await settleWithin(fixture.requestCanceled.promise, 100)).toBe(true);
            expect(await result).toBeInstanceOf(Error);
        } finally {
            fixture.server.forceShutdown();
        }
    });

    test("PostgreSQL stop enforces monitor timeout and destroys the active socket", async () => {
        const sockets = new Set();
        const requestArrived = deferred();
        const socketClosed = deferred();
        const server = net.createServer((socket) => {
            sockets.add(socket);
            requestArrived.resolve();
            socket.on("close", () => {
                sockets.delete(socket);
                socketClosed.resolve();
            });
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        const monitor = new Monitor();
        Object.assign(monitor, {
            timeout: 0.05,
            databaseConnectionString: `postgresql://user:pass@127.0.0.1:${server.address().port}/db`,
            databaseQuery: "SELECT 1",
        });
        const result = new PostgresMonitorType().check(monitor, {}).catch((error) => error);
        monitor.activeHeartbeat = result.then(() => {});
        await requestArrived.promise;

        const stopping = monitor.stop();
        const stoppedByDeadline = await settleWithin(stopping, 250);
        if (!stoppedByDeadline) {
            for (const socket of sockets) {
                socket.destroy();
            }
        }
        await stopping;

        try {
            expect(stoppedByDeadline).toBe(true);
            expect(await settleWithin(socketClosed.promise, 100)).toBe(true);
            expect(await result).toBeInstanceOf(Error);
        } finally {
            for (const socket of sockets) {
                socket.destroy();
            }
            await new Promise((resolve) => server.close(resolve));
        }
    });
});
