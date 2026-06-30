// @ts-nocheck
import { useToast } from "vue-toastification";
import dayjs from "dayjs";
import { createNativeWebSocket } from "@/util/native-websocket-client";
import { i18n } from "@/i18n";
import { router } from "@/router";
import { getDevBaseURL } from "@/util/dev-base-url";
import { getToastSuccessTimeout, getToastErrorTimeout } from "@/util-frontend";

const toast = useToast();

let socket;

export const noSocketIOPages = [
    /^\/status-page$/, //  /status-page
    /^\/status/, // /status**
    /^\/$/, //  /
];

/**
 * Resolve WebSocket server URL for the current environment.
 * @returns {string | undefined} Socket server URL
 */
export function resolveSocketUrl() {
    return getDevBaseURL() || undefined;
}

/**
 * Whether realtime socket connection should be skipped for the current route.
 * @param {boolean} bypass Should the status-page check be bypassed?
 * @returns {boolean} True when connection should be skipped
 */
export function shouldSkipSocketConnection(bypass = false) {
    if (!bypass && location.pathname) {
        for (const page of noSocketIOPages) {
            if (location.pathname.match(page)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Get current socket instance.
 * @returns {object | undefined} Current socket
 */
export function getSocket() {
    return socket;
}

/**
 * Emit an event on the current socket.
 * @param {string} event Event name
 * @param {...any} args Event arguments
 * @returns {void}
 */
export function socketEmit(event, ...args) {
    socket.emit(event, ...args);
}

/**
 * Register an event handler on the current socket.
 * @param {string} event Event name
 * @param {Function} handler Event handler
 * @returns {void}
 */
export function socketOn(event, handler) {
    socket.on(event, handler);
}

/**
 * Disconnect the current socket.
 * @returns {void}
 */
export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
    }
}

/**
 * Register all socket event handlers on the app store.
 * @param {object} store Pinia app store
 * @returns {void}
 */
function registerSocketHandlers(store) {
    const t = i18n.global.t;

    socket.on("info", (info) => {
        store.info = info;
    });

    socket.on("setup", () => {
        router.push("/setup");
    });

    socket.on("autoLogin", () => {
        store.loggedIn = true;
        store.storage().token = "autoLogin";
        store.socket.token = "autoLogin";
        store.allowLoginDialog = false;
    });

    socket.on("loginRequired", () => {
        const token = store.storage().token;
        if (token && token !== "autoLogin") {
            store.loginByToken(token);
        } else {
            store.storage().removeItem("token");
            store.allowLoginDialog = true;
        }
    });

    socket.on("monitorList", (data) => {
        store.assignMonitorUrlParser(data);
        store.monitorList = data;
    });

    socket.on("updateMonitorIntoList", (data) => {
        store.assignMonitorUrlParser(data);
        Object.entries(data).forEach(([monitorID, updatedMonitor]) => {
            store.monitorList[monitorID] = updatedMonitor;
        });
    });

    socket.on("deleteMonitorFromList", (monitorID) => {
        if (store.monitorList[monitorID]) {
            delete store.monitorList[monitorID];
        }
    });

    socket.on("monitorTypeList", (data) => {
        store.monitorTypeList = data;
    });

    socket.on("maintenanceList", (data) => {
        store.maintenanceList = data;
    });

    socket.on("apiKeyList", (data) => {
        store.apiKeyList = data;
    });

    socket.on("notificationList", (data) => {
        store.notificationList = data;
    });

    socket.on("statusPageList", (data) => {
        store.statusPageListLoaded = true;
        store.statusPageList = data;
    });

    socket.on("proxyList", (data) => {
        store.proxyList = data.map((item) => {
            item.auth = !!item.auth;
            item.active = !!item.active;
            item.default = !!item.default;

            return item;
        });
    });

    socket.on("dockerHostList", (data) => {
        store.dockerHostList = data;
    });

    socket.on("remoteBrowserList", (data) => {
        store.remoteBrowserList = data;
    });

    socket.on("heartbeat", (data) => {
        if (!(data.monitorID in store.heartbeatList)) {
            store.heartbeatList[data.monitorID] = [];
        }

        store.heartbeatList[data.monitorID].push(data);

        if (store.heartbeatList[data.monitorID].length >= 150) {
            store.heartbeatList[data.monitorID].shift();
        }

        if (data.important) {
            if (store.monitorList[data.monitorID] !== undefined) {
                if (data.status === 0) {
                    toast.error(`[${store.monitorList[data.monitorID].name}] [DOWN] ${data.msg}`, {
                        timeout: getToastErrorTimeout(),
                    });
                } else if (data.status === 1) {
                    toast.success(`[${store.monitorList[data.monitorID].name}] [Up] ${data.msg}`, {
                        timeout: getToastSuccessTimeout(),
                    });
                } else {
                    toast(`[${store.monitorList[data.monitorID].name}] ${data.msg}`);
                }
            }

            store.emitter.emit("newImportantHeartbeat", data);
        }
    });

    socket.on("heartbeatList", (monitorID, data, overwrite = false) => {
        if (!(monitorID in store.heartbeatList) || overwrite) {
            store.heartbeatList[monitorID] = data;
        } else {
            store.heartbeatList[monitorID] = data.concat(store.heartbeatList[monitorID]);
        }
    });

    socket.on("avgPing", (monitorID, data) => {
        store.avgPingList[monitorID] = data;
    });

    socket.on("uptime", (monitorID, type, data) => {
        store.uptimeList[`${monitorID}_${type}`] = data;
    });

    socket.on("certInfo", (monitorID, data) => {
        store.tlsInfoList[monitorID] = JSON.parse(data);
    });

    socket.on("domainInfo", (monitorID, daysRemaining, expiresOn) => {
        store.domainInfoList[monitorID] = { daysRemaining: daysRemaining, expiresOn: expiresOn };
    });

    socket.on("connect_error", (err) => {
        console.error(`Failed to connect to the backend. WebSocket connect_error: ${err.message || err.type || err}`);
        store.connectionErrorMsg = `${t("Cannot connect to the socket server.")} [${err}] ${t("Reconnecting...")}`;
        store.showReverseProxyGuide = true;
        store.socket.connected = false;
        store.socket.firstConnect = false;
    });

    socket.on("disconnect", () => {
        console.log("disconnect");
        store.connectionErrorMsg = `${t("Lost connection to the socket server.")} ${t("Reconnecting...")}`;
        store.socket.connected = false;
    });

    socket.on("connect", () => {
        console.log("Connected to the socket server");
        store.socket.connectCount++;
        store.socket.connected = true;
        store.showReverseProxyGuide = false;

        if (store.socket.connectCount >= 2) {
            store.clearData();
        }

        store.socket.firstConnect = false;
    });

    socket.on("cloudflared_installed", (res) => (store.cloudflared.installed = res));
    socket.on("cloudflared_running", (res) => (store.cloudflared.running = res));
    socket.on("cloudflared_message", (res) => (store.cloudflared.message = res));
    socket.on("cloudflared_errorMessage", (res) => (store.cloudflared.errorMessage = res));
    socket.on("cloudflared_token", (res) => (store.cloudflared.cloudflareTunnelToken = res));

    socket.on("initServerTimezone", () => {
        socket.emit("initServerTimezone", dayjs.tz.guess());
    });

    socket.on("refresh", () => {
        location.reload();
    });
}

/**
 * Initialize connection to socket server.
 * @param {object} store Pinia app store
 * @param {boolean} bypass Should the check for status pages be bypassed?
 * @returns {void}
 */
export function initSocket(store, bypass = false) {
    if (store.socket.initedSocketIO) {
        return;
    }

    if (shouldSkipSocketConnection(bypass)) {
        return;
    }

    store.socket.initedSocketIO = true;
    socket = createNativeWebSocket(resolveSocketUrl());
    registerSocketHandlers(store);
}
