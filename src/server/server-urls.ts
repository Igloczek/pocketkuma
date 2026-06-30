// @ts-nocheck

import { log } from "@/util";
import { networkInterfaces } from "os";

/**
 * Log the server's listening URLs, similar to Vite's dev server output.
 * When no hostname is specified (bound to all interfaces), it prints
 * localhost plus every non-internal network address.
 * @param {string} tag Log tag (e.g. "server", "setup-database")
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