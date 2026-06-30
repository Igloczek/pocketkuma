// @ts-nocheck

import dgram from "dgram";
import radius from "radius";
import { RADIUS_ATTRS } from "@/server/radius-attrs";

/**
 * Send a RADIUS Access-Request and wait for a response.
 * @param {object} options Request options
 * @param {string} options.host RADIUS server hostname
 * @param {number} options.port RADIUS server port
 * @param {number} options.timeout Request timeout in milliseconds
 * @param {number} options.retries Number of retry attempts
 * @param {string} options.secret RADIUS shared secret
 * @param {Array<[string, string]>} options.attributes Attribute name/value pairs
 * @returns {Promise<object>} RADIUS response
 */
function radiusAccessRequest({ host, port, timeout, retries, secret, attributes }) {
    return new Promise((resolve, reject) => {
        const packet = {
            code: "Access-Request",
            secret,
            attributes: Object.fromEntries(attributes),
        };

        let encodedPacket;
        try {
            encodedPacket = radius.encode(packet);
        } catch (error) {
            return reject(new Error(`RADIUS packet encoding failed: ${error.message}`));
        }

        const socket = dgram.createSocket("udp4");
        let attempts = 0;
        let responseReceived = false;
        let timeoutHandle;
        let socketClosed = false;

        const cleanup = () => {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
                timeoutHandle = null;
            }
            if (!socketClosed) {
                socketClosed = true;
                try {
                    socket.close();
                } catch {
                    // Ignore errors during cleanup
                }
            }
        };

        const sendRequest = () => {
            if (responseReceived || socketClosed) {
                return;
            }

            attempts++;

            socket.send(encodedPacket, 0, encodedPacket.length, port, host, (err) => {
                if (err) {
                    cleanup();
                    return reject(new Error(`Failed to send RADIUS request: ${err.message}`));
                }

                timeoutHandle = setTimeout(() => {
                    if (responseReceived || socketClosed) {
                        return;
                    }

                    if (attempts < retries + 1) {
                        sendRequest();
                    } else {
                        cleanup();
                        reject(new Error(`RADIUS request timeout after ${attempts} attempts`));
                    }
                }, timeout);
            });
        };

        socket.on("message", (msg) => {
            if (responseReceived || socketClosed) {
                return;
            }

            responseReceived = true;
            cleanup();

            let response;
            try {
                response = radius.decode({ packet: msg, secret });
            } catch (error) {
                return reject(new Error(`RADIUS response decoding failed: ${error.message}`));
            }

            const responseCode = response.code;

            if (responseCode === "Access-Accept") {
                resolve({ code: "Access-Accept", ...response });
            } else if (responseCode === "Access-Reject") {
                const error = new Error("Access-Reject");
                error.response = { code: "Access-Reject" };
                reject(error);
            } else if (responseCode === "Access-Challenge") {
                const error = new Error("Access-Challenge");
                error.response = { code: "Access-Challenge" };
                reject(error);
            } else {
                resolve({ code: responseCode, ...response });
            }
        });

        socket.on("error", (err) => {
            if (!responseReceived && !socketClosed) {
                responseReceived = true;
                cleanup();
                reject(new Error(`RADIUS socket error: ${err.message}`));
            }
        });

        sendRequest();
    });
}

/**
 * Query radius server
 * @param {string} hostname Hostname of radius server
 * @param {string} username Username to use
 * @param {string} password Password to use
 * @param {string} calledStationId ID of called station
 * @param {string} callingStationId ID of calling station
 * @param {string} secret Secret to use
 * @param {number} port Port to contact radius server on
 * @param {number} timeout Timeout for connection to use
 * @returns {Promise<any>} Response from server
 */
export function radius(
    hostname,
    username,
    password,
    calledStationId,
    callingStationId,
    secret,
    port = 1812,
    timeout = 2500
) {
    return radiusAccessRequest({
        host: hostname,
        port,
        timeout,
        retries: 1,
        secret,
        attributes: [
            [RADIUS_ATTRS.USER_NAME, username],
            [RADIUS_ATTRS.USER_PASSWORD, password],
            [RADIUS_ATTRS.CALLING_STATION_ID, callingStationId],
            [RADIUS_ATTRS.CALLED_STATION_ID, calledStationId],
        ],
    }).catch((error) => {
        if (error.response?.code) {
            const radiusError = new Error(`RADIUS ${error.response.code} from ${hostname}:${port}`);
            radiusError.response = error.response;
            radiusError.originalError = error;
            throw radiusError;
        }

        const enhancedError = new Error(`RADIUS authentication failed for ${hostname}:${port}: ${error.message}`);
        enhancedError.originalError = error;
        enhancedError.stack = error.stack || enhancedError.stack;
        throw enhancedError;
    });
}
