// @ts-nocheck

import { describe, test, expect } from "bun:test";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { GrpcKeywordMonitorType } from "../../../src/server/monitor-types/grpc.ts";
import { UP, PENDING } from "../../../src/util.ts";
import fs from "fs";
import path from "path";
import os from "os";

const testProto = `
syntax = "proto3";
package test;

service TestService {
    rpc Echo (EchoRequest) returns (EchoResponse);
}

message EchoRequest {
    string message = 1;
}

message EchoResponse {
    string message = 1;
}
`;

/**
 * Create a gRPC server for testing
 * @param {number} port Port to listen on
 * @param {object} methodHandlers Object with method handlers
 * @returns {Promise<grpc.Server>} gRPC server instance
 */
async function createTestGrpcServer(port, methodHandlers) {
    // Write proto to temp file
    const tmpDir = os.tmpdir();
    const protoPath = path.join(tmpDir, `test-${port}.proto`);
    fs.writeFileSync(protoPath, testProto);

    // Load proto file
    const packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
    });
    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const testPackage = protoDescriptor.test;

    const server = new grpc.Server();

    // Add service implementation
    server.addService(testPackage.TestService.service, {
        Echo: (call, callback) => {
            if (methodHandlers.Echo) {
                methodHandlers.Echo(call, callback);
            } else {
                callback(null, { message: call.request.message });
            }
        },
    });

    return new Promise((resolve, reject) => {
        server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err) => {
            if (err) {
                reject(err);
            } else {
                server.start();
                // Clean up temp file
                fs.unlinkSync(protoPath);
                resolve(server);
            }
        });
    });
}

describe.skipIf(!!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"))(
    "GrpcKeywordMonitorType",
    () => {
        test("check() sets status to UP when keyword is found in response", async () => {
            const port = 50051;
            const server = await createTestGrpcServer(port, {
                Echo: (call, callback) => {
                    callback(null, { message: "Hello World with SUCCESS keyword" });
                },
            });

            const grpcMonitor = new GrpcKeywordMonitorType();
            const monitor = {
                grpcUrl: `localhost:${port}`,
                grpcProtobuf: testProto,
                grpcServiceName: "test.TestService",
                grpcMethod: "echo",
                grpcBody: JSON.stringify({ message: "test" }),
                keyword: "SUCCESS",
                invertKeyword: false,
                grpcEnableTls: false,
                isInvertKeyword: () => false,
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await grpcMonitor.check(monitor, heartbeat);
                expect(heartbeat.status).toBe(UP);
                expect(heartbeat.msg.includes("SUCCESS")).toBeTruthy();
                expect(heartbeat.msg.includes("is")).toBeTruthy();
            } finally {
                server.forceShutdown();
            }
        });

        test("check() rejects when keyword is not found in response", async () => {
            const port = 50052;
            const server = await createTestGrpcServer(port, {
                Echo: (call, callback) => {
                    callback(null, { message: "Hello World without the expected keyword" });
                },
            });

            const grpcMonitor = new GrpcKeywordMonitorType();
            const monitor = {
                grpcUrl: `localhost:${port}`,
                grpcProtobuf: testProto,
                grpcServiceName: "test.TestService",
                grpcMethod: "echo",
                grpcBody: JSON.stringify({ message: "test" }),
                keyword: "MISSING",
                invertKeyword: false,
                grpcEnableTls: false,
                isInvertKeyword: () => false,
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                try {
                    await grpcMonitor.check(monitor, heartbeat);
                    expect.unreachable();
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    expect(msg.includes("MISSING")).toBe(true);
                    expect(msg.includes("not")).toBe(true);
                }
            } finally {
                server.forceShutdown();
            }
        });

        test("check() rejects when inverted keyword is present in response", async () => {
            const port = 50053;
            const server = await createTestGrpcServer(port, {
                Echo: (call, callback) => {
                    callback(null, { message: "Response with ERROR keyword" });
                },
            });

            const grpcMonitor = new GrpcKeywordMonitorType();
            const monitor = {
                grpcUrl: `localhost:${port}`,
                grpcProtobuf: testProto,
                grpcServiceName: "test.TestService",
                grpcMethod: "echo",
                grpcBody: JSON.stringify({ message: "test" }),
                keyword: "ERROR",
                invertKeyword: true,
                grpcEnableTls: false,
                isInvertKeyword: () => true,
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                try {
                    await grpcMonitor.check(monitor, heartbeat);
                    expect.unreachable();
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    expect(msg.includes("ERROR")).toBe(true);
                    expect(msg.includes("present")).toBe(true);
                }
            } finally {
                server.forceShutdown();
            }
        });

        test("check() sets status to UP when inverted keyword is not present in response", async () => {
            const port = 50054;
            const server = await createTestGrpcServer(port, {
                Echo: (call, callback) => {
                    callback(null, { message: "Response without error keyword" });
                },
            });

            const grpcMonitor = new GrpcKeywordMonitorType();
            const monitor = {
                grpcUrl: `localhost:${port}`,
                grpcProtobuf: testProto,
                grpcServiceName: "test.TestService",
                grpcMethod: "echo",
                grpcBody: JSON.stringify({ message: "test" }),
                keyword: "ERROR",
                invertKeyword: true,
                grpcEnableTls: false,
                isInvertKeyword: () => true,
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await grpcMonitor.check(monitor, heartbeat);
                expect(heartbeat.status).toBe(UP);
                expect(heartbeat.msg.includes("ERROR")).toBeTruthy();
                expect(heartbeat.msg.includes("not")).toBeTruthy();
            } finally {
                server.forceShutdown();
            }
        });

        test("check() rejects when gRPC server is unreachable", async () => {
            const grpcMonitor = new GrpcKeywordMonitorType();
            const monitor = {
                grpcUrl: "localhost:50099",
                grpcProtobuf: testProto,
                grpcServiceName: "test.TestService",
                grpcMethod: "echo",
                grpcBody: JSON.stringify({ message: "test" }),
                keyword: "SUCCESS",
                invertKeyword: false,
                grpcEnableTls: false,
                isInvertKeyword: () => false,
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            await expect(grpcMonitor.check(monitor, heartbeat)).rejects.toThrow();
        });

        test("check() truncates long response messages in error output", async () => {
            const port = 50055;
            const longMessage = "A".repeat(100) + " with SUCCESS keyword";

            const server = await createTestGrpcServer(port, {
                Echo: (call, callback) => {
                    callback(null, { message: longMessage });
                },
            });

            const grpcMonitor = new GrpcKeywordMonitorType();
            const monitor = {
                grpcUrl: `localhost:${port}`,
                grpcProtobuf: testProto,
                grpcServiceName: "test.TestService",
                grpcMethod: "echo",
                grpcBody: JSON.stringify({ message: "test" }),
                keyword: "MISSING",
                invertKeyword: false,
                grpcEnableTls: false,
                isInvertKeyword: () => false,
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                try {
                    await grpcMonitor.check(monitor, heartbeat);
                    expect.unreachable();
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    expect(msg.includes("...")).toBe(true);
                }
            } finally {
                server.forceShutdown();
            }
        });
    }
);
