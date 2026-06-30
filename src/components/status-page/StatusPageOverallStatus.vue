<template>
    <div class="shadow-box list p-4 overall-status mb-4">
        <div v-if="Object.keys($root.publicMonitorList).length === 0 && loadedData">
            <font-awesome-icon icon="question-circle" class="ok" />
            {{ $t("No Services") }}
        </div>

        <template v-else>
            <div v-if="allUp">
                <font-awesome-icon icon="check-circle" class="ok" />
                {{ $t("All Systems Operational") }}
            </div>

            <div v-else-if="partialDown">
                <font-awesome-icon icon="exclamation-circle" class="warning" />
                {{ $t("Partially Degraded Service") }}
            </div>

            <div v-else-if="allDown">
                <font-awesome-icon icon="times-circle" class="danger" />
                {{ $t("Degraded Service") }}
            </div>

            <div v-else-if="isMaintenance">
                <font-awesome-icon icon="wrench" class="status-maintenance" />
                {{ $t("maintenanceStatus-under-maintenance") }}
            </div>

            <div v-else>
                <font-awesome-icon icon="question-circle" style="color: #efefef" />
            </div>
        </template>
    </div>
</template>

<script>
import {
    STATUS_PAGE_ALL_DOWN,
    STATUS_PAGE_ALL_UP,
    STATUS_PAGE_MAINTENANCE,
    STATUS_PAGE_PARTIAL_DOWN,
    UP,
    MAINTENANCE,
} from "@/util";

export default {
    props: {
        loadedData: {
            type: Boolean,
            default: false,
        },
    },

    computed: {
        overallStatus() {
            if (Object.keys(this.$root.publicLastHeartbeatList).length === 0) {
                return -1;
            }

            let status = STATUS_PAGE_ALL_UP;
            let hasUp = false;

            for (let id in this.$root.publicLastHeartbeatList) {
                let beat = this.$root.publicLastHeartbeatList[id];

                if (beat.status === MAINTENANCE) {
                    return STATUS_PAGE_MAINTENANCE;
                } else if (beat.status === UP) {
                    hasUp = true;
                } else {
                    status = STATUS_PAGE_PARTIAL_DOWN;
                }
            }

            if (!hasUp) {
                status = STATUS_PAGE_ALL_DOWN;
            }

            return status;
        },

        allUp() {
            return this.overallStatus === STATUS_PAGE_ALL_UP;
        },

        partialDown() {
            return this.overallStatus === STATUS_PAGE_PARTIAL_DOWN;
        },

        allDown() {
            return this.overallStatus === STATUS_PAGE_ALL_DOWN;
        },

        isMaintenance() {
            return this.overallStatus === STATUS_PAGE_MAINTENANCE;
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.overall-status {
    font-weight: bold;
    font-size: 25px;

    .ok {
        color: $primary;
    }

    .warning {
        color: $warning;
    }

    .danger {
        color: $danger;
    }
}

.status-maintenance {
    color: $maintenance;
    margin-right: 5px;
}

.mobile {
    .overall-status {
        font-size: 20px;
    }
}
</style>
