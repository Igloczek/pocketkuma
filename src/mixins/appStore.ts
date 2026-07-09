// @ts-nocheck
import { useAppStore } from "@/stores/app";

/**
 * Bridge Pinia app store onto the root component instance.
 * Legacy templates still read `$root.socket`, `$root.loggedIn`, etc.
 */
export default {
    computed: {
        appStore() {
            return useAppStore();
        },

        // Keep `$root.*` working after the Pinia migration.
        socket() {
            return this.appStore.socket;
        },
        username() {
            return this.appStore.username;
        },
        usernameFirstChar() {
            return this.appStore.usernameFirstChar;
        },
        remember() {
            return this.appStore.remember;
        },
        allowLoginDialog() {
            return this.appStore.allowLoginDialog;
        },
        loggedIn() {
            return this.appStore.loggedIn;
        },
        monitorList() {
            return this.appStore.monitorList;
        },
        monitorTypeList() {
            return this.appStore.monitorTypeList;
        },
        maintenanceList() {
            return this.appStore.maintenanceList;
        },
        apiKeyList() {
            return this.appStore.apiKeyList;
        },
        heartbeatList() {
            return this.appStore.heartbeatList;
        },
        avgPingList() {
            return this.appStore.avgPingList;
        },
        uptimeList() {
            return this.appStore.uptimeList;
        },
        tlsInfoList() {
            return this.appStore.tlsInfoList;
        },
        domainInfoList() {
            return this.appStore.domainInfoList;
        },
        notificationList() {
            return this.appStore.notificationList;
        },
        dockerHostList() {
            return this.appStore.dockerHostList;
        },
        remoteBrowserList() {
            return this.appStore.remoteBrowserList;
        },
        statusPageListLoaded() {
            return this.appStore.statusPageListLoaded;
        },
        statusPageList() {
            return this.appStore.statusPageList;
        },
        proxyList() {
            return this.appStore.proxyList;
        },
        connectionErrorMsg() {
            return this.appStore.connectionErrorMsg;
        },
        showReverseProxyGuide() {
            return this.appStore.showReverseProxyGuide;
        },
        cloudflared() {
            return this.appStore.cloudflared;
        },
        publicGroupList() {
            return this.appStore.publicGroupList;
        },
        info() {
            return this.appStore.info;
        },
        emitter() {
            return this.appStore.emitter;
        },
        lastHeartbeatList() {
            return this.appStore.lastHeartbeatList;
        },
        statusList() {
            return this.appStore.statusList;
        },
        stats() {
            return this.appStore.stats;
        },
        frontendVersion() {
            return this.appStore.frontendVersion;
        },
        isFrontendBackendVersionMatched() {
            return this.appStore.isFrontendBackendVersionMatched;
        },
        publicMonitorList() {
            return this.appStore.publicMonitorList;
        },
        publicLastHeartbeatList() {
            return this.appStore.publicLastHeartbeatList;
        },
        baseURL() {
            return this.appStore.baseURL;
        },
    },

    methods: {
        initSocketIO(bypass = false) {
            return this.appStore.initSocketIO(bypass);
        },
        storage() {
            return this.appStore.storage();
        },
        getJWTPayload() {
            return this.appStore.getJWTPayload();
        },
        getSocket() {
            return this.appStore.getSocket();
        },
        applyTranslation(msg) {
            return this.appStore.applyTranslation(msg);
        },
        toastRes(res) {
            return this.appStore.toastRes(res);
        },
        toastSuccess(msg) {
            return this.appStore.toastSuccess(msg);
        },
        toastError(msg) {
            return this.appStore.toastError(msg);
        },
        login(username, password, token, callback) {
            return this.appStore.login(username, password, token, callback);
        },
        loginByToken(token) {
            return this.appStore.loginByToken(token);
        },
        logout() {
            return this.appStore.logout();
        },
        prepare2FA(callback) {
            return this.appStore.prepare2FA(callback);
        },
        save2FA(secret, callback) {
            return this.appStore.save2FA(secret, callback);
        },
        disable2FA(callback) {
            return this.appStore.disable2FA(callback);
        },
        verifyToken(token, callback) {
            return this.appStore.verifyToken(token, callback);
        },
        twoFAStatus(callback) {
            return this.appStore.twoFAStatus(callback);
        },
        getMonitorList(callback) {
            return this.appStore.getMonitorList(callback);
        },
        getMaintenanceList(callback) {
            return this.appStore.getMaintenanceList(callback);
        },
        getAPIKeyList(callback) {
            return this.appStore.getAPIKeyList(callback);
        },
        add(monitor, callback) {
            return this.appStore.add(monitor, callback);
        },
        addMaintenance(maintenance, callback) {
            return this.appStore.addMaintenance(maintenance, callback);
        },
        addMonitorMaintenance(maintenanceID, monitors, callback) {
            return this.appStore.addMonitorMaintenance(maintenanceID, monitors, callback);
        },
        addMaintenanceStatusPage(maintenanceID, statusPages, callback) {
            return this.appStore.addMaintenanceStatusPage(maintenanceID, statusPages, callback);
        },
        getMonitorMaintenance(maintenanceID, callback) {
            return this.appStore.getMonitorMaintenance(maintenanceID, callback);
        },
        getMaintenanceStatusPage(maintenanceID, callback) {
            return this.appStore.getMaintenanceStatusPage(maintenanceID, callback);
        },
        deleteMonitor(monitorID, deleteChildren, callback) {
            return this.appStore.deleteMonitor(monitorID, deleteChildren, callback);
        },
        deleteMaintenance(maintenanceID, callback) {
            return this.appStore.deleteMaintenance(maintenanceID, callback);
        },
        addAPIKey(key, callback) {
            return this.appStore.addAPIKey(key, callback);
        },
        deleteAPIKey(keyID, callback) {
            return this.appStore.deleteAPIKey(keyID, callback);
        },
        clearData() {
            return this.appStore.clearData();
        },
        uploadBackup(uploadedJSON, importHandle, callback) {
            return this.appStore.uploadBackup(uploadedJSON, importHandle, callback);
        },
        clearEvents(monitorID, callback) {
            return this.appStore.clearEvents(monitorID, callback);
        },
        clearHeartbeats(monitorID, callback) {
            return this.appStore.clearHeartbeats(monitorID, callback);
        },
        clearStatistics(callback) {
            return this.appStore.clearStatistics(callback);
        },
        getMonitorBeats(monitorID, period, callback) {
            return this.appStore.getMonitorBeats(monitorID, period, callback);
        },
        getMonitorChartData(monitorID, period, callback) {
            return this.appStore.getMonitorChartData(monitorID, period, callback);
        },
    },
};
