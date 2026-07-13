// @ts-nocheck

import { MonitorType } from "@/server/monitor-types/monitor-type";
import { UP, PING_COUNT_DEFAULT, PING_PER_REQUEST_TIMEOUT_DEFAULT } from "@/util";
import { Settings } from "@/server/settings";
import { ping, checkStatusCode } from "@/server/util-server";
import httpClient from "@/server/http-client";
import dns from "node:dns/promises";
import net from "node:net";

class SteamMonitorType extends MonitorType {
    name = "steam";

    /**
     * Creates a Steam monitor type.
     * @param {object} options Optional dependencies for tests.
     * @param {object} options.steamApiClient Axios-compatible Steam API client.
     * @param {Function} options.lookup DNS lookup function.
     * @param {Function} options.getSteamAPIKey Steam API key provider.
     * @param {Function} options.ping Steam server ping function.
     */
    constructor(options = {}) {
        super();

        this.steamApiClient = options.steamApiClient || httpClient;
        this.lookup = options.lookup || dns.lookup;
        this.getSteamAPIKey = options.getSteamAPIKey || (() => Settings.get("steamAPIKey"));
        this.ping = options.ping || ping;
    }

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat) {
        const steamApiUrl = "https://api.steampowered.com/IGameServersService/GetServerList/v1/";
        const timeout = monitor.timeout ?? 20;
        const deadline = Date.now() + timeout * 1000;
        const steamAPIKey = await this.getSteamAPIKey();

        if (!steamAPIKey) {
            throw new Error("Steam API Key not found");
        }

        const filter = await this.withDeadline(
            this.buildServerFilter(monitor.hostname, monitor.port),
            deadline,
            "Steam hostname lookup timed out"
        );

        let res = await this.steamApiClient.get(steamApiUrl, {
            timeout: this.remaining(deadline),
            headers: {
                Accept: "*/*",
            },
            tls: {
                rejectUnauthorized: !monitor.getIgnoreTls(),
            },
            maxRedirects: monitor.maxredirects,
            validateStatus: (status) => {
                return checkStatusCode(status, monitor.getAcceptedStatuscodes());
            },
            params: {
                filter: filter,
                key: steamAPIKey,
            },
        });

        if (res.data.response && res.data.response.servers && res.data.response.servers.length > 0) {
            heartbeat.status = UP;
            heartbeat.msg = res.data.response.servers[0].name;

            try {
                const pingTimeout = this.remaining(deadline) / 1000;
                heartbeat.ping = await this.ping(
                    monitor.hostname,
                    PING_COUNT_DEFAULT,
                    "",
                    true,
                    monitor.packetSize,
                    pingTimeout,
                    Math.min(pingTimeout, PING_PER_REQUEST_TIMEOUT_DEFAULT)
                );
            } catch (_) {}
        } else {
            throw new Error("Server not found on Steam");
        }
    }

    /**
     * Builds the Steam API server filter.
     * @param {string} hostname Steam server hostname or IP address.
     * @param {number} port Steam server port.
     * @returns {Promise<string>} Steam API addr filter.
     */
    async buildServerFilter(hostname, port) {
        const resolvedHostname = await this.resolveSteamHostname(hostname);
        return `addr\\${resolvedHostname}:${port}`;
    }

    /**
     * Resolves hostnames before passing them to Steam's addr filter.
     * @param {string} hostname Steam server hostname or IP address.
     * @returns {Promise<string>} IP address accepted by the Steam API.
     * @throws {Error} When the hostname cannot be resolved.
     */
    async resolveSteamHostname(hostname) {
        if (net.isIP(hostname)) {
            return hostname;
        }

        try {
            const lookupResult = await this.lookup(hostname, { all: true });
            const addresses = Array.isArray(lookupResult) ? lookupResult : [lookupResult];
            const ipv4Address = addresses.find(({ address }) => net.isIP(address) === 4);
            const resolvedAddress = ipv4Address?.address || addresses[0]?.address;

            if (!resolvedAddress) {
                throw new Error("DNS lookup returned no addresses");
            }

            return resolvedAddress;
        } catch (error) {
            throw new Error(`Unable to resolve Steam server hostname "${hostname}": ${error.message}`);
        }
    }

    /**
     * Return the positive time remaining before a deadline.
     * @param {number} deadline Absolute deadline in milliseconds.
     * @returns {number} Remaining milliseconds.
     */
    remaining(deadline) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
            throw new Error("Steam monitor timed out");
        }
        return remaining;
    }

    /**
     * Bound a non-cancellable system operation without allowing late side effects.
     * @param {Promise<any>} promise Operation promise.
     * @param {number} deadline Absolute deadline in milliseconds.
     * @param {string} message Timeout error message.
     * @returns {Promise<any>} Operation result.
     */
    async withDeadline(promise, deadline, message) {
        let timeoutID;
        try {
            return await Promise.race([
                promise,
                new Promise((_, reject) => {
                    timeoutID = setTimeout(() => reject(new Error(message)), this.remaining(deadline));
                }),
            ]);
        } finally {
            clearTimeout(timeoutID);
        }
    }
}

export { SteamMonitorType };
