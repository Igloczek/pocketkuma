// @ts-nocheck

import { R } from "@/server/bun-sqlite-store";
import { UptimeKumaServer } from "@/server/uptime-kuma-server";

class Proxy {
    static SUPPORTED_PROXY_PROTOCOLS = ["http", "https", "socks", "socks5", "socks5h", "socks4"];

    /**
     * Saves and updates given proxy entity
     * @param {object} proxy Proxy to store
     * @param {number} proxyID ID of proxy to update
     * @param {number} userID ID of user the proxy belongs to
     * @returns {Promise<Bean>} Updated proxy
     */
    static async save(proxy, proxyID, userID) {
        let bean;

        if (proxyID) {
            bean = await R.findOne("proxy", " id = ? AND user_id = ? ", [proxyID, userID]);

            if (!bean) {
                throw new Error("proxy not found");
            }
        } else {
            bean = R.dispense("proxy");
        }

        // Make sure given proxy protocol is supported
        if (!this.SUPPORTED_PROXY_PROTOCOLS.includes(proxy.protocol)) {
            throw new Error(`
                Unsupported proxy protocol "${proxy.protocol}.
                Supported protocols are ${this.SUPPORTED_PROXY_PROTOCOLS.join(", ")}."`);
        }

        // When proxy is default update deactivate old default proxy
        if (proxy.default) {
            await R.exec("UPDATE proxy SET `default` = 0 WHERE `default` = 1");
        }

        bean.user_id = userID;
        bean.protocol = proxy.protocol;
        bean.host = proxy.host;
        bean.port = proxy.port;
        bean.auth = proxy.auth;
        bean.username = proxy.username;
        bean.password = proxy.password;
        bean.active = proxy.active || true;
        bean.default = proxy.default || false;

        await R.store(bean);

        if (proxy.applyExisting) {
            await applyProxyEveryMonitor(bean.id, userID);
        }

        return bean;
    }

    /**
     * Deletes proxy with given id and removes it from monitors
     * @param {number} proxyID ID of proxy to delete
     * @param {number} userID ID of proxy owner
     * @returns {Promise<void>}
     */
    static async delete(proxyID, userID) {
        const bean = await R.findOne("proxy", " id = ? AND user_id = ? ", [proxyID, userID]);

        if (!bean) {
            throw new Error("proxy not found");
        }

        // Delete removed proxy from monitors if exists
        await R.exec("UPDATE monitor SET proxy_id = null WHERE proxy_id = ?", [proxyID]);

        // Delete proxy from list
        await R.trash(bean);
    }

    /**
     * Reload proxy settings for current monitors
     * @returns {Promise<void>}
     */
    static async reloadProxy() {
        const server = UptimeKumaServer.getInstance();

        let updatedList = await R.getAssoc("SELECT id, proxy_id FROM monitor");

        for (let monitorID in server.monitorList) {
            let monitor = server.monitorList[monitorID];

            if (updatedList[monitorID]) {
                monitor.proxy_id = updatedList[monitorID].proxy_id;
            }
        }
    }
}

/**
 * Applies given proxy id to monitors
 * @param {number} proxyID ID of proxy to apply
 * @param {number} userID ID of proxy owner
 * @returns {Promise<void>}
 */
async function applyProxyEveryMonitor(proxyID, userID) {
    // Find all monitors with id and proxy id
    const monitors = await R.getAll("SELECT id, proxy_id FROM monitor WHERE user_id = ?", [userID]);

    // Update proxy id not match with given proxy id
    for (const monitor of monitors) {
        if (monitor.proxy_id !== proxyID) {
            await R.exec("UPDATE monitor SET proxy_id = ? WHERE id = ?", [proxyID, monitor.id]);
        }
    }
}

export { Proxy };
