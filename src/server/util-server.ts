// @ts-nocheck

import { R } from "@/server/redbean-compat";
import { runCommand, commandExists } from "@/server/process-helper";
import {
    log,
    genSecret,
    badgeConstants,
    PING_PACKET_SIZE_DEFAULT,
    PING_GLOBAL_TIMEOUT_DEFAULT,
    PING_COUNT_DEFAULT,
    PING_PER_REQUEST_TIMEOUT_DEFAULT,
} from "@/util";
import passwordHash from "@/server/password-hash";
import iconv from "iconv-lite";
import chardet from "chardet";
import chroma from "chroma-js";

import { Settings } from "@/server/settings";
import { RADIUS_ATTRS } from "@/server/radius-attrs";
import oidc from "openid-client";
import tls from "tls";
import dgram from "dgram";
import radius from "radius";
import { exists } from "fs";
import { networkInterfaces } from "os";
import { domainToASCII } from "node:url";
import dayjs from "dayjs";
import { Kafka, SASLOptions } from "kafkajs";
import crypto, { X509Certificate } from "node:crypto";
import dayjsPlugin_19 from "dayjs/plugin/utc";

dayjs.extend(dayjsPlugin_19);

// SASLOptions used in JSDoc
// eslint-disable-next-line no-unused-vars

const isWindows = process.platform === /^win/.test(process.platform);
/**
 * Init or reset JWT secret
 * @returns {Promise<Bean>} JWT secret
 */
export const initJWTSecret = async () => {
    let jwtSecretBean = await R.findOne("setting", " `key` = ? ", ["jwtSecret"]);

    if (!jwtSecretBean) {
        jwtSecretBean = R.dispense("setting");
        jwtSecretBean.key = "jwtSecret";
    }

    jwtSecretBean.value = await passwordHash.generate(genSecret());
    await R.store(jwtSecretBean);
    return jwtSecretBean;
};

/**
 * Decodes a jwt and returns the payload portion without verifying the jwt.
 * @param {string} jwt The input jwt as a string
 * @returns {object} Decoded jwt payload object
 */
export const decodeJwt = (jwt) => {
    return JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString());
};

/**
 * Gets an Access Token from an oidc/oauth2 provider
 * @param {string} tokenEndpoint The token URI from the auth service provider
 * @param {string} clientId The oidc/oauth application client id
 * @param {string} clientSecret The oidc/oauth application client secret
 * @param {string} scope The scope(s) for which the token should be issued for
 * @param {string} audience The audience for which the token should be issued for
 * @param {string} authMethod The method used to send the credentials. Default client_secret_basic
 * @returns {Promise<oidc.TokenSet>} TokenSet promise if the token request was successful
 */
export const getOidcTokenClientCredentials = async (
    tokenEndpoint,
    clientId,
    clientSecret,
    scope,
    audience,
    authMethod = "client_secret_basic"
) => {
    const oauthProvider = new oidc.Issuer({ token_endpoint: tokenEndpoint });
    let client = new oauthProvider.Client({
        client_id: clientId,
        client_secret: clientSecret,
        token_endpoint_auth_method: authMethod,
    });

    // Increase default timeout and clock tolerance
    client[oidc.custom.http_options] = () => ({ timeout: 10000 });
    client[oidc.custom.clock_tolerance] = 5;

    let grantParams = { grant_type: "client_credentials" };
    if (scope) {
        grantParams.scope = scope;
    }

    if (audience) {
        grantParams.audience = audience;
    }
    return await client.grant(grantParams);
};

/**
 * Ping the specified machine
 * @param {string} destAddr Hostname / IP address of machine to ping
 * @param {number} count Number of packets to send before stopping
 * @param {string} sourceAddr Source address for sending/receiving echo requests
 * @param {boolean} numeric If true, IP addresses will be output instead of symbolic hostnames
 * @param {number} size Size (in bytes) of echo request to send
 * @param {number} deadline Maximum time in seconds before ping stops, regardless of packets sent
 * @param {number} timeout Maximum time in seconds to wait for each response
 * @returns {Promise<number>} Time for ping in ms rounded to nearest integer
 */
export const ping = async (
    destAddr,
    count = PING_COUNT_DEFAULT,
    sourceAddr = "",
    numeric = true,
    size = PING_PACKET_SIZE_DEFAULT,
    deadline = PING_GLOBAL_TIMEOUT_DEFAULT,
    timeout = PING_PER_REQUEST_TIMEOUT_DEFAULT
) => {
    try {
        return await pingAsync(destAddr, false, count, sourceAddr, numeric, size, deadline, timeout);
    } catch (e) {
        // If the host cannot be resolved, try again with ipv6
        log.debug("ping", "IPv6 error message: " + e.message);

        // As node-ping does not report a specific error for this, try again if it is an empty message with ipv6 no matter what.
        if (!e.message) {
            return await pingAsync(destAddr, true, count, sourceAddr, numeric, size, deadline, timeout);
        } else {
            throw e;
        }
    }
};

/**
 * Ping the specified machine
 * @param {string} destAddr Hostname / IP address of machine to ping
 * @param {boolean} ipv6 Should IPv6 be used?
 * @param {number} count Number of packets to send before stopping
 * @param {string} sourceAddr Source address for sending/receiving echo requests
 * @param {boolean} numeric If true, IP addresses will be output instead of symbolic hostnames
 * @param {number} size Size (in bytes) of echo request to send
 * @param {number} deadline Maximum time in seconds before ping stops, regardless of packets sent
 * @param {number} timeout Maximum time in seconds to wait for each response
 * @returns {Promise<number>} Time for ping in ms rounded to nearest integer
 */
export function pingAsync(
    destAddr,
    ipv6 = false,
    count = PING_COUNT_DEFAULT,
    sourceAddr = "",
    numeric = true,
    size = PING_PACKET_SIZE_DEFAULT,
    deadline = PING_GLOBAL_TIMEOUT_DEFAULT,
    timeout = PING_PER_REQUEST_TIMEOUT_DEFAULT
) {
    try {
        const url = new URL(`http://${destAddr}`);
        destAddr = url.hostname;
        if (destAddr.startsWith("[") && destAddr.endsWith("]")) {
            destAddr = destAddr.slice(1, -1);
        }
    } catch (e) {
        // ignore
    }

    if (!ipv6 && !destAddr.includes(":")) {
        destAddr = domainToASCII(destAddr);
    }

    return pingByProcess(destAddr, ipv6, count, sourceAddr, numeric, size, deadline, timeout);
}

async function pingByProcess(destAddr, ipv6, count, sourceAddr, numeric, size, deadline, timeout) {
    const args = buildPingArgs(destAddr, ipv6, count, sourceAddr, numeric, size, deadline, timeout);
    const result = await runCommand("ping", args, {
        timeout: Math.max(deadline, timeout) * 1000 + 1000,
    });
    const output = result.stderr || result.stdout;

    if (result.code !== 0) {
        const message = isWindows ? convertToUTF8(output) : output;
        throw new Error(message || `ping ${destAddr} failed with exit code ${result.code}`);
    }

    const time = parsePingTime(result.stdout);
    if (time === null) {
        throw new Error(output || "Unable to parse ping response");
    }
    return time;
}

function buildPingArgs(destAddr, ipv6, count, sourceAddr, numeric, size, deadline, timeout) {
    if (process.platform === "win32") {
        const args = [ipv6 ? "-6" : "-4", "-n", String(count), "-w", String(timeout * 1000), "-l", String(size)];
        if (numeric) {
            args.push("-a");
        }
        args.push(destAddr);
        return args;
    }

    const args = [];
    if (ipv6 && process.platform !== "darwin" && process.platform !== "freebsd" && process.platform !== "openbsd") {
        args.push("-6");
    }
    if (numeric) {
        args.push("-n");
    }
    args.push("-c", String(count), "-s", String(size));
    if (process.platform === "darwin" || process.platform === "freebsd" || process.platform === "openbsd") {
        args.push("-W", String(timeout * 1000));
    } else {
        args.push("-W", String(timeout), "-w", String(deadline));
    }
    if (sourceAddr) {
        args.push("-I", sourceAddr);
    }
    args.push(destAddr);
    return args;
}

function parsePingTime(output) {
    const avgMatch = output.match(/(?:min\/avg\/max|round-trip).*?=\s*[\d.]+\/([\d.]+)/);
    if (avgMatch) {
        return Math.round(Number(avgMatch[1]));
    }

    const singleMatch = output.match(/time[=<]\s*([\d.]+)\s*ms/i);
    if (singleMatch) {
        return Math.round(Number(singleMatch[1]));
    }

    return null;
}

/**
 * Monitor Kafka using Producer
 * @param {string[]} brokers List of kafka brokers to connect, host and
 * port joined by ':'
 * @param {string} topic Topic name to produce into
 * @param {string} message Message to produce
 * @param {object} options Kafka client options. Contains ssl, clientId,
 * allowAutoTopicCreation and interval (interval defaults to 20,
 * allowAutoTopicCreation defaults to false, clientId defaults to
 * "Uptime-Kuma" and ssl defaults to false)
 * @param {SASLOptions} saslOptions Options for kafka client
 * Authentication (SASL) (defaults to {})
 * @returns {Promise<string>} Status message
 */
export function kafkaProducerAsync(brokers, topic, message, options = {}, saslOptions = {}) {
    return new Promise((resolve, reject) => {
        const {
            interval = 20,
            allowAutoTopicCreation = false,
            ssl = false,
            clientId = "Uptime-Kuma",
            connectionTimeout = 1,
        } = options;

        let connectedToKafka = false;

        const timeoutID = setTimeout(
            () => {
                log.debug("kafkaProducer", "KafkaProducer timeout triggered");
                connectedToKafka = true;
                reject(new Error("Timeout"));
            },
            interval * 1000 * 0.8
        );

        if (saslOptions.mechanism === "None") {
            saslOptions = undefined;
        }

        let client = new Kafka({
            brokers: brokers,
            clientId: clientId,
            sasl: saslOptions,
            retry: {
                retries: 0,
            },
            ssl: ssl,
            connectionTimeout: connectionTimeout * 1000,
        });

        let producer = client.producer({
            allowAutoTopicCreation: allowAutoTopicCreation,
            retry: {
                retries: 0,
            },
        });

        producer
            .connect()
            .then(() => {
                producer
                    .send({
                        topic: topic,
                        messages: [
                            {
                                value: message,
                            },
                        ],
                    })
                    .then((_) => {
                        resolve("Message sent successfully");
                    })
                    .catch((e) => {
                        connectedToKafka = true;
                        producer.disconnect();
                        clearTimeout(timeoutID);
                        reject(new Error("Error sending message: " + e.message));
                    })
                    .finally(() => {
                        connectedToKafka = true;
                        clearTimeout(timeoutID);
                    });
            })
            .catch((e) => {
                connectedToKafka = true;
                producer.disconnect();
                clearTimeout(timeoutID);
                reject(new Error("Error in producer connection: " + e.message));
            });

        producer.on("producer.network.request_timeout", (_) => {
            if (!connectedToKafka) {
                clearTimeout(timeoutID);
                reject(new Error("producer.network.request_timeout"));
            }
        });

        producer.on("producer.disconnect", (_) => {
            if (!connectedToKafka) {
                clearTimeout(timeoutID);
                reject(new Error("producer.disconnect"));
            }
        });
    });
}

/**
 * Send a RADIUS Access-Request over UDP.
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

/**
 * Retrieve value of setting based on key
 * @param {string} key Key of setting to retrieve
 * @returns {Promise<any>} Value
 * @deprecated Use await Settings.get(key)
 */
export async function setting(key) {
    return await Settings.get(key);
}

/**
 * Sets the specified setting to specified value
 * @param {string} key Key of setting to set
 * @param {any} value Value to set to
 * @param {?string} type Type of setting
 * @returns {Promise<void>}
 */
export async function setSetting(key, value, type = null) {
    await Settings.set(key, value, type);
}

/**
 * Get settings based on type
 * @param {string} type The type of setting
 * @returns {Promise<Bean>} Settings of requested type
 */
export async function getSettings(type) {
    return await Settings.getSettings(type);
}

/**
 * Set settings based on type
 * @param {string} type Type of settings to set
 * @param {object} data Values of settings
 * @returns {Promise<void>}
 */
export async function setSettings(type, data) {
    await Settings.setSettings(type, data);
}

// ssl-checker by @dyaa
//https://github.com/dyaa/ssl-checker/blob/master/src/index.ts

/**
 * Get number of days between two dates
 * @param {Date} validFrom Start date
 * @param {Date} validTo End date
 * @returns {number} Number of days
 */
const getDaysBetween = (validFrom, validTo) => Math.round(Math.abs(+validFrom - +validTo) / 8.64e7);

/**
 * Get days remaining from a time range
 * @param {Date} validFrom Start date
 * @param {Date} validTo End date
 * @returns {number} Number of days remaining
 */
export const getDaysRemaining = (validFrom, validTo) => {
    const daysRemaining = getDaysBetween(validFrom, validTo);
    if (new Date(validTo).getTime() < new Date().getTime()) {
        return -daysRemaining;
    }
    return daysRemaining;
};

/**
 * Fix certificate info for display
 * @param {object} info The chain obtained from getPeerCertificate()
 * @returns {object} An object representing certificate information
 * @throws The certificate chain length exceeded 500.
 */
const parseCertificateInfo = function (info) {
    let link = info;
    let i = 0;

    const existingList = {};

    while (link) {
        log.debug("cert", `[${i}] ${link.fingerprint}`);

        if (!link.valid_from || !link.valid_to) {
            break;
        }
        link.validTo = new Date(link.valid_to);
        link.validFor = link.subjectaltname?.replace(/DNS:|IP Address:/g, "").split(", ");
        link.daysRemaining = dayjs.utc(link.validTo).diff(dayjs.utc(), "day");

        existingList[link.fingerprint] = true;

        // Move up the chain until loop is encountered
        if (link.issuerCertificate == null) {
            link.certType = i === 0 ? "self-signed" : "root CA";
            break;
        } else if (link.issuerCertificate.fingerprint in existingList) {
            // a root CA certificate is typically "signed by itself"  (=> "self signed certificate") and thus the "issuerCertificate" is a reference to itself.
            log.debug("cert", `[Last] ${link.issuerCertificate.fingerprint}`);
            link.certType = i === 0 ? "self-signed" : "root CA";
            link.issuerCertificate = null;
            break;
        } else {
            link.certType = i === 0 ? "server" : "intermediate CA";
            link = link.issuerCertificate;
        }

        // Should be no use, but just in case.
        if (i > 500) {
            throw new Error("Dead loop occurred in parseCertificateInfo");
        }
        i++;
    }

    return info;
};

/**
 * Check if certificate is valid
 * @param {tls.TLSSocket} socket TLSSocket, which may or may not be connected
 * @returns {null | {valid: boolean, certInfo: object}} Object containing certificate information
 */
export function checkCertificate(socket) {
    let certInfoStartTime = dayjs().valueOf();

    // Return null if there is no socket
    if (socket === undefined || socket == null) {
        return null;
    }

    const info = socket.getPeerCertificate(true);
    const valid = socket.authorized || false;

    log.debug("cert", "Parsing Certificate Info");
    const parsedInfo = parseCertificateInfo(info);

    if (process.env.TIMELOGGER === "1") {
        log.debug("monitor", "Cert Info Query Time: " + (dayjs().valueOf() - certInfoStartTime) + "ms");
    }

    return {
        valid: valid,
        certInfo: parsedInfo,
    };
}

/**
 * Checks if the certificate is valid for the provided hostname.
 * Defaults to true if feature `X509Certificate` is not available, or input is not valid.
 * @param {Buffer} certBuffer - The certificate buffer.
 * @param {string} hostname - The hostname to compare against.
 * @returns {boolean} True if the certificate is valid for the provided hostname, false otherwise.
 */
export function checkCertificateHostname(certBuffer, hostname) {
    if (!X509Certificate || !certBuffer || !hostname) {
        return true;
    }

    let certObject = new X509Certificate(certBuffer);
    return certObject.checkHost(hostname) !== undefined;
}

/**
 * Check if the provided status code is within the accepted ranges
 * @param {number} status The status code to check
 * @param {string[]} acceptedCodes An array of accepted status codes
 * @returns {boolean} True if status code within range, false otherwise
 */
export function checkStatusCode(status, acceptedCodes) {
    if (acceptedCodes == null || acceptedCodes.length === 0) {
        return false;
    }

    for (const codeRange of acceptedCodes) {
        if (typeof codeRange !== "string") {
            log.error("monitor", `Accepted status code not a string. ${codeRange} is of type ${typeof codeRange}`);
            continue;
        }

        const codeRangeSplit = codeRange.split("-").map((string) => parseInt(string));
        if (codeRangeSplit.length === 1) {
            if (status === codeRangeSplit[0]) {
                return true;
            }
        } else if (codeRangeSplit.length === 2) {
            if (status >= codeRangeSplit[0] && status <= codeRangeSplit[1]) {
                return true;
            }
        } else {
            log.error("monitor", `${codeRange} is not a valid status code range`);
            continue;
        }
    }

    return false;
}

/**
 * Get total number of clients in room
 * @param {Server} io Socket server instance
 * @param {string} roomName Name of room to check
 * @returns {number} Total clients in room
 */
export const getTotalClientInRoom = (io, roomName) => {
    const sockets = io.sockets;

    if (!sockets) {
        return 0;
    }

    const adapter = sockets.adapter;

    if (!adapter) {
        return 0;
    }

    const room = adapter.rooms.get(roomName);

    if (room) {
        return room.size;
    } else {
        return 0;
    }
};

/**
 * Allow CORS all origins if development
 * @param {object} res Response object from axios
 * @returns {void}
 */
export const allowDevAllOrigin = (res) => {
    if (process.env.NODE_ENV === "development") {
        allowAllOrigin(res);
    }
};

/**
 * Allow CORS all origins
 * @param {object} res Response object from axios
 * @returns {void}
 */
export const allowAllOrigin = (res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
};

/**
 * Check if a user is logged in
 * @param {Socket} socket Socket instance
 * @returns {void}
 * @throws The user is not logged in
 */
export const checkLogin = (socket) => {
    if (!socket.userID) {
        throw new Error("You are not logged in.");
    }
};

/**
 * For logged-in users, double-check the password
 * @param {Socket} socket Socket.io instance
 * @param {string} currentPassword Password to validate
 * @returns {Promise<Bean>} User
 * @throws The current password is not a string
 * @throws The provided password is not correct
 */
export const doubleCheckPassword = async (socket, currentPassword) => {
    if (typeof currentPassword !== "string") {
        throw new Error("Wrong data type?");
    }

    let user = await R.findOne("user", " id = ? AND active = 1 ", [socket.userID]);

    if (!user || !(await passwordHash.verify(currentPassword, user.password))) {
        throw new Error("Incorrect current password");
    }

    return user;
};

/**
 * Convert unknown string to UTF8
 * @param {Uint8Array} body Buffer
 * @returns {string} UTF8 string
 */
export const convertToUTF8 = (body) => {
    const guessEncoding = chardet.detect(body);
    const str = iconv.decode(body, guessEncoding);
    return str.toString();
};

/**
 * Returns a color code in hex format based on a given percentage:
 * 0% => hue = 10 => red
 * 100% => hue = 90 => green
 * @param {number} percentage float, 0 to 1
 * @param {number} maxHue Maximum hue - int
 * @param {number} minHue Minimum hue - int
 * @returns {string} Color in hex
 */
export const percentageToColor = (percentage, maxHue = 90, minHue = 10) => {
    const hue = percentage * (maxHue - minHue) + minHue;
    try {
        return chroma(`hsl(${hue}, 90%, 40%)`).hex();
    } catch (err) {
        return badgeConstants.naColor;
    }
};

/**
 * Joins and array of string to one string after filtering out empty values
 * @param {string[]} parts Strings to join
 * @param {string} connector Separator for joined strings
 * @returns {string} Joined strings
 */
export const filterAndJoin = (parts, connector = "") => {
    return parts.filter((part) => !!part && part !== "").join(connector);
};

/**
 * Send an Error response
 * @param {object} res HTTP response object
 * @param {string} msg Message to send
 * @returns {void}
 */
export const sendHttpError = (res, msg = "") => {
    if (msg.includes("SQLITE_BUSY") || msg.includes("SQLITE_LOCKED")) {
        res.status(503).json({
            status: "fail",
            msg: msg,
        });
    } else if (msg.toLowerCase().includes("not found")) {
        res.status(404).json({
            status: "fail",
            msg: msg,
        });
    } else {
        res.status(403).json({
            status: "fail",
            msg: msg,
        });
    }
};

/**
 * Convert timezone of time object
 * @param {object} obj Time object to update
 * @param {string} timezone New timezone to set
 * @param {boolean} timeObjectToUTC Convert time object to UTC
 * @returns {object} Time object with updated timezone
 */
function timeObjectConvertTimezone(obj, timezone, timeObjectToUTC = true) {
    let offsetString;

    if (timezone) {
        offsetString = dayjs().tz(timezone).format("Z");
    } else {
        offsetString = dayjs().format("Z");
    }

    let hours = parseInt(offsetString.substring(1, 3));
    let minutes = parseInt(offsetString.substring(4, 6));

    if ((timeObjectToUTC && offsetString.startsWith("+")) || (!timeObjectToUTC && offsetString.startsWith("-"))) {
        hours *= -1;
        minutes *= -1;
    }

    obj.hours += hours;
    obj.minutes += minutes;

    // Handle out of bound
    if (obj.minutes < 0) {
        obj.minutes += 60;
        obj.hours--;
    } else if (obj.minutes > 60) {
        obj.minutes -= 60;
        obj.hours++;
    }

    if (obj.hours < 0) {
        obj.hours += 24;
    } else if (obj.hours > 24) {
        obj.hours -= 24;
    }

    return obj;
}

/**
 * Convert time object to UTC
 * @param {object} obj Object to convert
 * @param {string} timezone Timezone of time object
 * @returns {object} Updated time object
 */
export const timeObjectToUTC = (obj, timezone = undefined) => {
    return timeObjectConvertTimezone(obj, timezone, true);
};

/**
 * Convert time object to local time
 * @param {object} obj Object to convert
 * @param {string} timezone Timezone to convert to
 * @returns {object} Updated object
 */
export const timeObjectToLocal = (obj, timezone = undefined) => {
    return timeObjectConvertTimezone(obj, timezone, false);
};

/**
 * Returns an array of SHA256 fingerprints for all known root certificates.
 * @returns {Set} A set of SHA256 fingerprints.
 */
export const rootCertificatesFingerprints = () => {
    let fingerprints = tls.rootCertificates.map((cert) => {
        let certLines = cert.split("\n");
        certLines.shift();
        certLines.pop();
        let certBody = certLines.join("");
        let buf = Buffer.from(certBody, "base64");

        const shasum = crypto.createHash("sha256");
        shasum.update(buf);

        return shasum
            .digest("hex")
            .toUpperCase()
            .replace(/(.{2})(?!$)/g, "$1:");
    });

    fingerprints.push(
        "6D:99:FB:26:5E:B1:C5:B3:74:47:65:FC:BC:64:8F:3C:D8:E1:BF:FA:FD:C4:C2:F9:9B:9D:47:CF:7F:F1:C2:4F"
    ); // ISRG X1 cross-signed with DST X3
    fingerprints.push(
        "8B:05:B6:8C:C6:59:E5:ED:0F:CB:38:F2:C9:42:FB:FD:20:0E:6F:2F:F9:F8:5D:63:C6:99:4E:F5:E0:B0:27:01"
    ); // ISRG X2 cross-signed with ISRG X1

    return new Set(fingerprints);
};

export const SHAKE256_LENGTH = 16;

/**
 * @param {string} data The data to be hashed
 * @param {number} len Output length of the hash
 * @returns {string} The hashed data in hex format
 */
export const shake256 = (data, len) => {
    if (!data) {
        return "";
    }
    return crypto.createHash("shake256", { outputLength: len }).update(data).digest("hex");
};

/**
 * Non await sleep
 * Source: https://stackoverflow.com/questions/59099454/is-there-a-way-to-call-sleep-without-await-keyword
 * @param {number} n Milliseconds to wait
 * @returns {void}
 */
export const wait = (n) => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
};

// For unit test, export functions
export const __test = process.env.TEST_BACKEND
    ? {
          parseCertificateInfo,
      }
    : undefined;
export const __getPrivateFunction = process.env.TEST_BACKEND
    ? (functionName) => {
          return __test[functionName];
      }
    : undefined;

/**
 * Generates an abort signal with the specified timeout.
 * @param {number} timeoutMs - The timeout in milliseconds.
 * @returns {AbortSignal | null} - The generated abort signal, or null if not supported.
 */
export const axiosAbortSignal = (timeoutMs) => {
    try {
        // Just in case, as 0 timeout here will cause the request to be aborted immediately
        if (!timeoutMs || timeoutMs <= 0) {
            timeoutMs = 5000;
        }
        return AbortSignal.timeout(timeoutMs);
    } catch (_) {
        // v16-: AbortSignal.timeout is not supported
        try {
            const abortController = new AbortController();
            setTimeout(() => abortController.abort(), timeoutMs);

            return abortController.signal;
        } catch (_) {
            // v15-: AbortController is not supported
            return null;
        }
    }
};

/**
 * Async version of fs.existsSync
 * @param {PathLike} path File path
 * @returns {Promise<boolean>} True if file exists, false otherwise
 */
export function fsExists(path) {
    return new Promise(function (resolve, reject) {
        exists(path, function (exists) {
            resolve(exists);
        });
    });
}

/**
 * Encode user and password to Base64 encoding
 * for HTTP "basic" auth, as per RFC-7617
 * @param {string|null} user - The username (defaults to empty string if null/undefined)
 * @param {string|null} pass - The password (defaults to empty string if null/undefined)
 * @returns {string} Encoded Base64 string
 */
export function encodeBase64(user, pass) {
    return Buffer.from(`${user || ""}:${pass || ""}`).toString("base64");
}

/**
 * checks certificate chain for expiring certificates
 * @param {object} monitor - The monitor object
 * @param {object} tlsInfoObject Information about certificate
 * @returns {Promise<void>}
 */
export async function checkCertExpiryNotifications(monitor, tlsInfoObject) {
    if (!tlsInfoObject || !tlsInfoObject.certInfo || !tlsInfoObject.certInfo.daysRemaining) {
        return;
    }

    let notificationList = await R.getAll(
        "SELECT notification.* FROM notification, monitor_notification WHERE monitor_id = ? AND monitor_notification.notification_id = notification.id ",
        [monitor.id]
    );

    if (!notificationList.length > 0) {
        // fail fast. If no notification is set, all the following checks can be skipped.
        log.debug("monitor", "No notification, no need to send cert notification");
        return;
    }

    let notifyDays = await Settings.get("tlsExpiryNotifyDays");
    if (notifyDays == null || !Array.isArray(notifyDays)) {
        // Reset Default
        await Settings.set("tlsExpiryNotifyDays", [7, 14, 21], "general");
        notifyDays = [7, 14, 21];
    }

    for (const targetDays of notifyDays) {
        let certInfo = tlsInfoObject.certInfo;
        while (certInfo) {
            let subjectCN = certInfo.subject["CN"];
            if (monitor.rootCertificates.has(certInfo.fingerprint256)) {
                log.debug(
                    "monitor",
                    `Known root cert: ${certInfo.certType} certificate "${subjectCN}" (${certInfo.daysRemaining} days valid) on ${targetDays} deadline.`
                );
                break;
            } else if (certInfo.daysRemaining > targetDays) {
                log.debug(
                    "monitor",
                    `No need to send cert notification for ${certInfo.certType} certificate "${subjectCN}" (${certInfo.daysRemaining} days valid) on ${targetDays} deadline.`
                );
            } else {
                log.debug(
                    "monitor",
                    `call sendCertNotificationByTargetDays for ${targetDays} deadline on certificate ${subjectCN}.`
                );
                await monitor.sendCertNotificationByTargetDays(
                    subjectCN,
                    certInfo.certType,
                    certInfo.daysRemaining,
                    targetDays,
                    notificationList
                );
            }
            certInfo = certInfo.issuerCertificate;
        }
    }
}

export { commandExists };

/**
 * Log the server's listening URLs, similar to Vite's dev server output.
 * When no hostname is specified (bound to all interfaces), it prints
 * localhost plus every non-internal network address.
 * @param {string} tag Log tag (e.g. "server", "db")
 * @param {number} port Port number
 * @param {string} hostname Bound hostname, if any
 * @param {boolean} isHTTPS Whether the server is using HTTPS
 * @returns {void}
 */
export const printServerUrls = (tag, port, hostname, isHTTPS = false) => {
    try {
        // If hostname is specified, just print that one.
        if (hostname) {
            log.info(tag, `Listening on: `, createURL(isHTTPS, hostname, port));
            return;
        }

        // Since no hostname is specified, which means the server is bound to all interfaces, we need to print all possible URLs.
        const nets = networkInterfaces();

        log.info(tag, "Listening on:");
        log.info(tag, `- `, createURL(isHTTPS, "localhost", port));

        // Prepare a list of valid address
        const addressList = [];
        for (const iface of Object.values(nets)) {
            for (const addr of iface) {
                if (!addr.internal) {
                    addressList.push(addr);
                }
            }
        }

        // Sort IPv4 addresses first
        addressList.sort((a, b) => {
            if (a.family === "IPv4" && b.family === "IPv6") {
                return -1;
            } else if (a.family === "IPv6" && b.family === "IPv4") {
                return 1;
            } else {
                return a.address.localeCompare(b.address);
            }
        });

        for (const address of addressList) {
            if (!address.internal) {
                const host = address.family === "IPv6" ? `[${address.address}]` : address.address;
                log.info(tag, `- `, createURL(isHTTPS, host, port));
            }
        }
    } catch (e) {
        log.error(tag, "Error printing server URLs: " + e.message);
    }
};

/**
 * Construct a URL a bit more safely
 * @param {boolean} isHTTPS Whether the URL should use HTTPS protocol
 * @param {string} hostname The hostname to use in the URL
 * @param {number} port The port
 * @returns {string} The constructed URL as a string
 */
function createURL(isHTTPS, hostname, port = 80) {
    const url = new URL((isHTTPS ? "https" : "http") + `://` + hostname);
    url.port = String(port);

    // Prefer origin if available, it doesn't contain the trailing slash
    return url.origin || url.toString();
}
