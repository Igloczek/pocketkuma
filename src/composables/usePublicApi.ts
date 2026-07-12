// @ts-nocheck
import { storeToRefs } from "pinia";
import { useAppStore } from "@/stores/app";

/**
 * Public status page API state shared across the app.
 * @returns {object} Public API composable API
 */
export function usePublicApi() {
    const { publicGroupList, publicMonitorList, publicLastHeartbeatList, baseURL } = storeToRefs(useAppStore());

    return {
        publicGroupList,
        publicMonitorList,
        publicLastHeartbeatList,
        baseURL,
    };
}
