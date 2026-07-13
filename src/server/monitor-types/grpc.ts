// @ts-nocheck

import { MonitorType } from "@/server/monitor-types/monitor-type";
import { UP, log } from "@/util";
import dayjs from "dayjs";
import grpc from "@grpc/grpc-js";
import protojs from "protobufjs";

class GrpcKeywordMonitorType extends MonitorType {
    name = "grpc-keyword";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const startTime = dayjs().valueOf();
        const { service, client } = this.constructGrpcService(
            monitor.grpcUrl,
            monitor.grpcProtobuf,
            monitor.grpcServiceName,
            monitor.grpcEnableTls,
            (monitor.timeout ?? 20) * 1000
        );
        let response;
        try {
            response = await this.grpcQuery(service, monitor.grpcMethod, monitor.grpcBody);
        } finally {
            client.close();
        }
        heartbeat.ping = dayjs().valueOf() - startTime;
        log.debug(this.name, "gRPC response:", response);
        let keywordFound = response.toString().includes(monitor.keyword);
        if (keywordFound !== !monitor.isInvertKeyword()) {
            log.debug(
                this.name,
                `GRPC response [${response}] + ", but keyword [${monitor.keyword}] is ${keywordFound ? "present" : "not"} in [" + ${response} + "]"`
            );

            let truncatedResponse = response.length > 50 ? response.toString().substring(0, 47) + "..." : response;

            throw new Error(
                `keyword [${monitor.keyword}] is ${keywordFound ? "present" : "not"} in [" + ${truncatedResponse} + "]`
            );
        }
        heartbeat.status = UP;
        heartbeat.msg = `${response}, keyword [${monitor.keyword}] ${keywordFound ? "is" : "not"} found`;
    }

    /**
     * Create gRPC client
     * @param {string} url grpc Url
     * @param {string} protobufData grpc ProtobufData
     * @param {string} serviceName grpc ServiceName
     * @param {string} enableTls grpc EnableTls
     * @param {number} timeout Request deadline in milliseconds
     * @returns {{service: grpc.Service, client: grpc.Client}} grpc Service and client
     */
    constructGrpcService(url, protobufData, serviceName, enableTls, timeout) {
        const protocObject = protojs.parse(protobufData);
        const protoServiceObject = protocObject.root.lookupService(serviceName);
        const Client = grpc.makeGenericClientConstructor({});
        const credentials = enableTls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure();
        const client = new Client(url, credentials);
        const service = protoServiceObject.create(
            (method, requestData, cb) => {
                const fullServiceName = method.fullName;
                const serviceFQDN = fullServiceName.split(".");
                const serviceMethod = serviceFQDN.pop();
                const serviceMethodClientImpl = `/${serviceFQDN.slice(1).join(".")}/${serviceMethod}`;
                log.debug(this.name, `gRPC method ${serviceMethodClientImpl}`);
                client.makeUnaryRequest(
                    serviceMethodClientImpl,
                    (arg) => arg,
                    (arg) => arg,
                    requestData,
                    { deadline: Date.now() + timeout },
                    cb
                );
            },
            false,
            false
        );
        return { service, client };
    }

    /**
     * Create gRPC client stib
     * @param {grpc.Service} service grpc Url
     * @param {string} method grpc Method
     * @param {string} body grpc Body
     * @returns {Promise<string>} Result of gRPC query
     */
    async grpcQuery(service, method, body) {
        return new Promise((resolve, reject) => {
            try {
                service[method](JSON.parse(body), (err, response) => {
                    if (err) {
                        if (err.code === 1) {
                            log.debug(this.name, `ignoring ${err.code} ${err.details}, as code=1 is considered OK`);
                            resolve(`${err.code} is considered OK because ${err.details}`);
                        } else {
                            reject(err);
                        }
                        return;
                    }
                    resolve(JSON.stringify(response));
                });
            } catch (err) {
                reject(err);
            }
        });
    }
}

export { GrpcKeywordMonitorType };
