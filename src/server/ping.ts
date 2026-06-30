// @ts-nocheck

import { runCommand } from "@/server/process-helper";
import {
    log,
    PING_PACKET_SIZE_DEFAULT,
    PING_GLOBAL_TIMEOUT_DEFAULT,
    PING_COUNT_DEFAULT,
    PING_PER_REQUEST_TIMEOUT_DEFAULT,
} from "@/util";
import { domainToASCII } from "node:url";
import { convertToUTF8 } from "@/server/encoding";

const isWindows = process.platform === /^win/.test(process.platform);

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