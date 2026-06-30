// @ts-nocheck
import { defineStore } from "pinia";
import { watch } from "vue";
import { useToast } from "vue-toastification";
import jwtDecode from "@/util/jwt-decode";
import { createEventEmitter } from "@/util/event-emitter";
import { getSocket, initSocket, noSocketIOPages, socketEmit } from "@/composables/useSocket";
import { updateFaviconBadge } from "@/util/favicon-badge";
import { getDevApiBaseURL } from "@/util/dev-api-base";
import { i18n } from "@/i18n";
import { router } from "@/router";

import { DOWN, MAINTENANCE, PENDING, UP } from "@/constants";

const toast = useToast();
const env = process.env.NODE_ENV || "production";

let watchersInitialized = false;

export const useAppStore = defineStore("app", {
    state: () => ({
        info: {},
        socket: {
            token: null,
            firstConnect: true,
            connected: false,
            connectCount: 0,
            initedSocketIO: false,
        },
        username: null,
        remember: localStorage.remember !== "0",
        allowLoginDialog: false,
        loggedIn: false,
        monitorList: {},
        monitorTypeList: {},
        maintenanceList: {},
        apiKeyList: {},
        heartbeatList: {},
        avgPingList: {},
        uptimeList: {},
        tlsInfoList: {},
        domainInfoList: {},
        notificationList: [],
        dockerHostList: [],
        remoteBrowserList: [],
        statusPageListLoaded: false,
        statusPageList: [],
        proxyList: [],
        connectionErrorMsg: "",
        showReverseProxyGuide: true,
        cloudflared: {
            cloudflareTunnelToken: "",
            installed: null,
            running: false,
            message: "",
            errorMessage: "",
            currentPassword: "",
        },
        publicGroupList: [],
        emitter: createEventEmitter(),
    }),

    getters: {
        usernameFirstChar(state) {
            if (typeof state.username === "string" && state.username.length >= 1) {
                return state.username.charAt(0).toUpperCase();
            }
            return "🐻";
        },

        lastHeartbeatList(state) {
            const result = {};

            for (const monitorID in state.heartbeatList) {
                const index = state.heartbeatList[monitorID].length - 1;
                result[monitorID] = state.heartbeatList[monitorID][index];
            }

            return result;
        },

        statusList() {
            const result = {};
            const t = i18n.global.t;

            const unknown = {
                text: t("Unknown"),
                color: "secondary",
            };

            for (const monitorID in this.lastHeartbeatList) {
                const lastHeartBeat = this.lastHeartbeatList[monitorID];

                if (!lastHeartBeat) {
                    result[monitorID] = unknown;
                } else if (lastHeartBeat.status === UP) {
                    result[monitorID] = {
                        text: t("Up"),
                        color: "primary",
                    };
                } else if (lastHeartBeat.status === DOWN) {
                    result[monitorID] = {
                        text: t("Down"),
                        color: "danger",
                    };
                } else if (lastHeartBeat.status === PENDING) {
                    result[monitorID] = {
                        text: t("Pending"),
                        color: "warning",
                    };
                } else if (lastHeartBeat.status === MAINTENANCE) {
                    result[monitorID] = {
                        text: t("statusMaintenance"),
                        color: "maintenance",
                    };
                } else {
                    result[monitorID] = unknown;
                }
            }

            return result;
        },

        stats() {
            const result = {
                active: 0,
                up: 0,
                down: 0,
                maintenance: 0,
                pending: 0,
                unknown: 0,
                pause: 0,
            };

            for (const monitorID in this.monitorList) {
                const beat = this.lastHeartbeatList[monitorID];
                const monitor = this.monitorList[monitorID];

                if (monitor && !monitor.active) {
                    result.pause++;
                } else if (beat) {
                    result.active++;
                    if (beat.status === UP) {
                        result.up++;
                    } else if (beat.status === DOWN) {
                        result.down++;
                    } else if (beat.status === PENDING) {
                        result.pending++;
                    } else if (beat.status === MAINTENANCE) {
                        result.maintenance++;
                    } else {
                        result.unknown++;
                    }
                } else {
                    result.unknown++;
                }
            }

            return result;
        },

        frontendVersion() {
            // eslint-disable-next-line no-undef
            return FRONTEND_VERSION;
        },

        isFrontendBackendVersionMatched(state) {
            if (!state.info.version) {
                return true;
            }
            return state.info.version === this.frontendVersion;
        },

        publicMonitorList(state) {
            const result = {};

            for (const group of state.publicGroupList) {
                for (const monitor of group.monitorList) {
                    result[monitor.id] = monitor;
                }
            }
            return result;
        },

        publicLastHeartbeatList() {
            const result = {};

            for (const monitorID in this.publicMonitorList) {
                if (this.lastHeartbeatList[monitorID]) {
                    result[monitorID] = this.lastHeartbeatList[monitorID];
                }
            }

            return result;
        },

        baseURL(state) {
            if (state.info.primaryBaseURL) {
                return state.info.primaryBaseURL;
            }

            if (env === "development" || localStorage.dev === "dev") {
                return getDevApiBaseURL();
            }
            return location.protocol + "//" + location.host;
        },
    },

    actions: {
        initConnectionErrorMsg() {
            const t = i18n.global.t;
            this.connectionErrorMsg = `${t("Cannot connect to the socket server.")} ${t("Reconnecting...")}`;
        },

        initSocketIO(bypass = false) {
            initSocket(this, bypass);
        },

        assignMonitorUrlParser(data) {
            Object.entries(data).forEach(([monitorID, monitor]) => {
                monitor.getUrl = () => {
                    try {
                        return new URL(monitor.url);
                    } catch (_) {
                        return null;
                    }
                };
            });
            return data;
        },

        storage() {
            return this.remember ? localStorage : sessionStorage;
        },

        getJWTPayload() {
            const jwtToken = this.storage().token;

            if (jwtToken && jwtToken !== "autoLogin") {
                return jwtDecode(jwtToken);
            }
            return undefined;
        },

        getSocket() {
            return getSocket();
        },

        applyTranslation(msg) {
            const t = i18n.global.t;
            if (msg != null && typeof msg === "object") {
                return t(msg.key, msg.values);
            }
            return t(msg);
        },

        toastRes(res) {
            if (res.msgi18n) {
                res.msg = this.applyTranslation(res.msg);
            }

            if (res.ok) {
                toast.success(res.msg);
            } else {
                toast.error(res.msg);
            }
        },

        toastSuccess(msg) {
            toast.success(i18n.global.t(msg));
        },

        toastError(msg) {
            toast.error(i18n.global.t(msg));
        },

        login(username, password, token, callback) {
            socketEmit(
                "login",
                {
                    username,
                    password,
                    token,
                },
                (res) => {
                    if (res.tokenRequired) {
                        callback(res);
                    }

                    if (res.ok) {
                        this.storage().token = res.token;
                        this.socket.token = res.token;
                        this.loggedIn = true;
                        this.username = this.getJWTPayload()?.username;

                        history.pushState({}, "");
                    }

                    callback(res);
                }
            );
        },

        loginByToken(token) {
            socketEmit("loginByToken", token, (res) => {
                this.allowLoginDialog = true;

                if (!res.ok) {
                    this.logout();
                } else {
                    this.loggedIn = true;
                    this.username = this.getJWTPayload()?.username;
                }
            });
        },

        logout() {
            socketEmit("logout", () => {});
            this.storage().removeItem("token");
            this.socket.token = null;
            this.loggedIn = false;
            this.username = null;
            this.clearData();
        },

        prepare2FA(callback) {
            socketEmit("prepare2FA", callback);
        },

        save2FA(secret, callback) {
            socketEmit("save2FA", callback);
        },

        disable2FA(callback) {
            socketEmit("disable2FA", callback);
        },

        verifyToken(token, callback) {
            socketEmit("verifyToken", token, callback);
        },

        twoFAStatus(callback) {
            socketEmit("twoFAStatus", callback);
        },

        getMonitorList(callback) {
            if (!callback) {
                callback = () => {};
            }
            socketEmit("getMonitorList", callback);
        },

        getMaintenanceList(callback) {
            if (!callback) {
                callback = () => {};
            }
            socketEmit("getMaintenanceList", callback);
        },

        getAPIKeyList(callback) {
            if (!callback) {
                callback = () => {};
            }
            socketEmit("getAPIKeyList", callback);
        },

        add(monitor, callback) {
            socketEmit("add", monitor, callback);
        },

        addMaintenance(maintenance, callback) {
            socketEmit("addMaintenance", maintenance, callback);
        },

        addMonitorMaintenance(maintenanceID, monitors, callback) {
            socketEmit("addMonitorMaintenance", maintenanceID, monitors, callback);
        },

        addMaintenanceStatusPage(maintenanceID, statusPages, callback) {
            socketEmit("addMaintenanceStatusPage", maintenanceID, statusPages, callback);
        },

        getMonitorMaintenance(maintenanceID, callback) {
            socketEmit("getMonitorMaintenance", maintenanceID, callback);
        },

        getMaintenanceStatusPage(maintenanceID, callback) {
            socketEmit("getMaintenanceStatusPage", maintenanceID, callback);
        },

        deleteMonitor(monitorID, deleteChildren, callback) {
            socketEmit("deleteMonitor", monitorID, deleteChildren, callback);
        },

        deleteMaintenance(maintenanceID, callback) {
            socketEmit("deleteMaintenance", maintenanceID, callback);
        },

        addAPIKey(key, callback) {
            socketEmit("addAPIKey", key, callback);
        },

        deleteAPIKey(keyID, callback) {
            socketEmit("deleteAPIKey", keyID, callback);
        },

        clearData() {
            console.log("reset heartbeat list");
            this.heartbeatList = {};
        },

        uploadBackup(uploadedJSON, importHandle, callback) {
            socketEmit("uploadBackup", uploadedJSON, importHandle, callback);
        },

        clearEvents(monitorID, callback) {
            socketEmit("clearEvents", monitorID, callback);
        },

        clearHeartbeats(monitorID, callback) {
            socketEmit("clearHeartbeats", monitorID, callback);
        },

        clearStatistics(callback) {
            socketEmit("clearStatistics", callback);
        },

        getMonitorBeats(monitorID, period, callback) {
            socketEmit("getMonitorBeats", monitorID, period, callback);
        },

        getMonitorChartData(monitorID, period, callback) {
            socketEmit("getMonitorChartData", monitorID, period, callback);
        },
    },
});

/**
 * Initialize store watchers for favicon, version reload, remember, and route changes.
 * @returns {void}
 */
export function initAppStoreWatchers() {
    if (watchersInitialized) {
        return;
    }
    watchersInitialized = true;

    const store = useAppStore();
    store.initConnectionErrorMsg();
    store.initSocketIO();

    watch(
        () => store.stats.down,
        (to, from) => {
            if (to !== from) {
                updateFaviconBadge(to);
            }
        }
    );

    watch(
        () => store.info.version,
        (to, from) => {
            if (from && from !== to) {
                window.location.reload();
            }
        }
    );

    watch(
        () => store.remember,
        (remember) => {
            localStorage.remember = remember ? "1" : "0";
        }
    );

    watch(
        () => router.currentRoute.value.fullPath,
        (newValue) => {
            if (newValue) {
                for (const page of noSocketIOPages) {
                    if (newValue.match(page)) {
                        return;
                    }
                }
            }

            store.initSocketIO();
        }
    );
}
