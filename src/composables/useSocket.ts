// @ts-nocheck
import { useToast } from "vue-toastification";
import dayjs from "dayjs";
import { createNativeWebSocket } from "@/util/native-websocket-client";
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
 * Register all socket event handlers on the Vue root context.
 * @param {object} context Vue component instance
 * @returns {void}
 */
function registerSocketHandlers(context) {
    socket.on("info", (info) => {
        context.info = info;
    });

    socket.on("setup", () => {
        context.$router.push("/setup");
    });

    socket.on("autoLogin", () => {
        context.loggedIn = true;
        context.storage().token = "autoLogin";
        context.socket.token = "autoLogin";
        context.allowLoginDialog = false;
    });

    socket.on("loginRequired", () => {
        const token = context.storage().token;
        if (token && token !== "autoLogin") {
            context.loginByToken(token);
        } else {
            context.$root.storage().removeItem("token");
            context.allowLoginDialog = true;
        }
    });

    socket.on("monitorList", (data) => {
        context.assignMonitorUrlParser(data);
        context.monitorList = data;
    });

    socket.on("updateMonitorIntoList", (data) => {
        context.assignMonitorUrlParser(data);
        Object.entries(data).forEach(([monitorID, updatedMonitor]) => {
            context.monitorList[monitorID] = updatedMonitor;
        });
    });

    socket.on("deleteMonitorFromList", (monitorID) => {
        if (context.monitorList[monitorID]) {
            delete context.monitorList[monitorID];
        }
    });

    socket.on("monitorTypeList", (data) => {
        context.monitorTypeList = data;
    });

    socket.on("maintenanceList", (data) => {
        context.maintenanceList = data;
    });

    socket.on("apiKeyList", (data) => {
        context.apiKeyList = data;
    });

    socket.on("notificationList", (data) => {
        context.notificationList = data;
    });

    socket.on("statusPageList", (data) => {
        context.statusPageListLoaded = true;
        context.statusPageList = data;
    });

    socket.on("proxyList", (data) => {
        context.proxyList = data.map((item) => {
            item.auth = !!item.auth;
            item.active = !!item.active;
            item.default = !!item.default;

            return item;
        });
    });

    socket.on("dockerHostList", (data) => {
        context.dockerHostList = data;
    });

    socket.on("remoteBrowserList", (data) => {
        context.remoteBrowserList = data;
    });

    socket.on("heartbeat", (data) => {
        if (!(data.monitorID in context.heartbeatList)) {
            context.heartbeatList[data.monitorID] = [];
        }

        context.heartbeatList[data.monitorID].push(data);

        if (context.heartbeatList[data.monitorID].length >= 150) {
            context.heartbeatList[data.monitorID].shift();
        }

        if (data.important) {
            if (context.monitorList[data.monitorID] !== undefined) {
                if (data.status === 0) {
                    toast.error(`[${context.monitorList[data.monitorID].name}] [DOWN] ${data.msg}`, {
                        timeout: getToastErrorTimeout(),
                    });
                } else if (data.status === 1) {
                    toast.success(`[${context.monitorList[data.monitorID].name}] [Up] ${data.msg}`, {
                        timeout: getToastSuccessTimeout(),
                    });
                } else {
                    toast(`[${context.monitorList[data.monitorID].name}] ${data.msg}`);
                }
            }

            context.emitter.dispatchEvent(new CustomEvent("newImportantHeartbeat", { detail: data }));
        }
    });

    socket.on("heartbeatList", (monitorID, data, overwrite = false) => {
        if (!(monitorID in context.heartbeatList) || overwrite) {
            context.heartbeatList[monitorID] = data;
        } else {
            context.heartbeatList[monitorID] = data.concat(context.heartbeatList[monitorID]);
        }
    });

    socket.on("avgPing", (monitorID, data) => {
        context.avgPingList[monitorID] = data;
    });

    socket.on("uptime", (monitorID, type, data) => {
        context.uptimeList[`${monitorID}_${type}`] = data;
    });

    socket.on("certInfo", (monitorID, data) => {
        context.tlsInfoList[monitorID] = JSON.parse(data);
    });

    socket.on("domainInfo", (monitorID, daysRemaining, expiresOn) => {
        context.domainInfoList[monitorID] = { daysRemaining: daysRemaining, expiresOn: expiresOn };
    });

    socket.on("connect_error", (err) => {
        console.error(`Failed to connect to the backend. WebSocket connect_error: ${err.message || err.type || err}`);
        context.connectionErrorMsg = `${context.$t("Cannot connect to the socket server.")} [${err}] ${context.$t("Reconnecting...")}`;
        context.showReverseProxyGuide = true;
        context.socket.connected = false;
        context.socket.firstConnect = false;
    });

    socket.on("disconnect", () => {
        console.log("disconnect");
        context.connectionErrorMsg = `${context.$t("Lost connection to the socket server.")} ${context.$t("Reconnecting...")}`;
        context.socket.connected = false;
    });

    socket.on("connect", () => {
        console.log("Connected to the socket server");
        context.socket.connectCount++;
        context.socket.connected = true;
        context.showReverseProxyGuide = false;

        if (context.socket.connectCount >= 2) {
            context.clearData();
        }

        context.socket.firstConnect = false;
    });

    socket.on("cloudflared_installed", (res) => (context.cloudflared.installed = res));
    socket.on("cloudflared_running", (res) => (context.cloudflared.running = res));
    socket.on("cloudflared_message", (res) => (context.cloudflared.message = res));
    socket.on("cloudflared_errorMessage", (res) => (context.cloudflared.errorMessage = res));
    socket.on("cloudflared_token", (res) => (context.cloudflared.cloudflareTunnelToken = res));

    socket.on("initServerTimezone", () => {
        socket.emit("initServerTimezone", dayjs.tz.guess());
    });

    socket.on("refresh", () => {
        location.reload();
    });
}

/**
 * Initialize connection to socket server.
 * @param {object} context Vue component instance
 * @param {boolean} bypass Should the check for status pages be bypassed?
 * @returns {void}
 */
export function initSocket(context, bypass = false) {
    if (context.socket.initedSocketIO) {
        return;
    }

    if (shouldSkipSocketConnection(bypass)) {
        return;
    }

    context.socket.initedSocketIO = true;
    socket = createNativeWebSocket(resolveSocketUrl());
    registerSocketHandlers(context);
}
