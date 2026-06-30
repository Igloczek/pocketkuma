// @ts-nocheck
import { ref, computed, getCurrentInstance } from "vue";
import { getDevApiBaseURL } from "@/util/dev-api-base";

const env = process.env.NODE_ENV || "production";

const publicGroupList = ref([]);

/**
 * Get the root Vue instance (socket state still lives on $root until task 029).
 * @returns {object | undefined} Root instance proxy
 */
function getRoot() {
    return getCurrentInstance()?.proxy?.$root;
}

const publicMonitorList = computed(() => {
    const result = {};

    for (const group of publicGroupList.value) {
        for (const monitor of group.monitorList) {
            result[monitor.id] = monitor;
        }
    }
    return result;
});

const publicLastHeartbeatList = computed(() => {
    const result = {};
    const lastHeartbeatList = getRoot()?.lastHeartbeatList ?? {};

    for (const monitorID in publicMonitorList.value) {
        if (lastHeartbeatList[monitorID]) {
            result[monitorID] = lastHeartbeatList[monitorID];
        }
    }

    return result;
});

const baseURL = computed(() => {
    const info = getRoot()?.info ?? {};

    if (info.primaryBaseURL) {
        return info.primaryBaseURL;
    }

    if (env === "development" || localStorage.dev === "dev") {
        return getDevApiBaseURL();
    }
    return location.protocol + "//" + location.host;
});

/**
 * Public status page API state shared across the app.
 * @returns {object} Public API composable API
 */
export function usePublicApi() {
    return {
        publicGroupList,
        publicMonitorList,
        publicLastHeartbeatList,
        baseURL,
    };
}
