<template>
    <div v-if="pastIncidentCount > 0" class="past-incidents-section mb-4">
        <h2 class="past-incidents-title mb-3">
            {{ $t("Past Incidents") }}
        </h2>

        <div class="past-incidents-content">
            <div v-for="(dateGroup, dateKey) in groupedIncidentHistory" :key="dateKey" class="incident-date-group mb-4">
                <h4 class="incident-date-header">{{ dateKey }}</h4>
                <div class="shadow-box incident-list-box">
                    <IncidentHistory
                        :incidents="dateGroup"
                        :edit-mode="enableEditMode"
                        :loading="incidentHistoryLoading"
                        @edit-incident="$emit('edit-incident', $event)"
                        @delete-incident="$emit('delete-incident', $event)"
                        @resolve-incident="$emit('resolve-incident', $event)"
                    />
                </div>
            </div>

            <div v-if="incidentHistoryHasMore" class="load-more-controls d-flex justify-content-center mt-3">
                <button
                    class="btn btn-outline-secondary btn-sm"
                    :disabled="incidentHistoryLoading"
                    @click="$emit('load-more')"
                >
                    <span
                        v-if="incidentHistoryLoading"
                        class="spinner-border spinner-border-sm me-1"
                        role="status"
                    ></span>
                    {{ $t("Load More") }}
                </button>
            </div>
        </div>
    </div>
</template>

<script>
import IncidentHistory from "@/components/IncidentHistory.vue";

export default {
    components: {
        IncidentHistory,
    },

    props: {
        pastIncidentCount: {
            type: Number,
            required: true,
        },
        groupedIncidentHistory: {
            type: Object,
            required: true,
        },
        enableEditMode: {
            type: Boolean,
            default: false,
        },
        incidentHistoryLoading: {
            type: Boolean,
            default: false,
        },
        incidentHistoryHasMore: {
            type: Boolean,
            default: false,
        },
    },

    emits: ["load-more", "edit-incident", "delete-incident", "resolve-incident"],
};
</script>

<style lang="scss" scoped>
.past-incidents-title {
    font-size: 26px;
    font-weight: normal;
}

.past-incidents-section {
    .past-incidents-content {
        padding: 0;
    }
}

.incident-date-group {
    .incident-date-header {
        font-size: 1rem;
        font-weight: normal;
        color: var(--bs-secondary);
        margin-bottom: 0.75rem;
    }

    .incident-list-box {
        padding: 0;
    }
}
</style>
