<template>
    <template v-for="activeIncident in activeIncidents" :key="activeIncident.id">
        <IncidentEditForm
            v-if="editIncidentMode && incident !== null && incident.id === activeIncident.id"
            :model-value="incident"
            @update:model-value="$emit('update:incident', $event)"
            @post="$emit('post-incident')"
            @cancel="$emit('cancel-incident')"
        />

        <div
            v-else
            class="shadow-box alert mb-4 p-4 incident"
            role="alert"
            :class="'bg-' + activeIncident.style"
            data-testid="incident"
        >
            <h4 class="alert-heading" data-testid="incident-title">{{ activeIncident.title }}</h4>
            <!-- eslint-disable vue/no-v-html -->
            <div class="content" data-testid="incident-content" v-html="sanitizeMarkdown(activeIncident.content)"></div>
            <!-- eslint-enable vue/no-v-html -->

            <div class="date mt-3">
                {{
                    $t("dateCreatedAtFromNow", {
                        date: $root.datetime(activeIncident.createdDate),
                        fromNow: dateFromNow(activeIncident.createdDate),
                    })
                }}
                <br />
                <span v-if="activeIncident.lastUpdatedDate">
                    {{
                        $t("lastUpdatedAtFromNow", {
                            date: $root.datetime(activeIncident.lastUpdatedDate),
                            fromNow: dateFromNow(activeIncident.lastUpdatedDate),
                        })
                    }}
                </span>
            </div>

            <div v-if="editMode" class="mt-3">
                <button class="btn btn-light me-2" @click="$emit('resolve-incident', activeIncident)">
                    <font-awesome-icon icon="check" />
                    {{ $t("Resolve") }}
                </button>
                <button class="btn btn-light me-2" @click="$emit('edit-incident', activeIncident)">
                    <font-awesome-icon icon="edit" />
                    {{ $t("Edit") }}
                </button>
                <button class="btn btn-light me-2" @click="$emit('delete-incident', activeIncident)">
                    <font-awesome-icon icon="unlink" />
                    {{ $t("Delete") }}
                </button>
            </div>
        </div>
    </template>
</template>

<script>
import dayjs from "dayjs";
import IncidentEditForm from "@/components/IncidentEditForm.vue";
import { sanitizeMarkdown } from "@/util/markdown-sanitize";

export default {
    components: {
        IncidentEditForm,
    },

    props: {
        activeIncidents: {
            type: Array,
            required: true,
        },
        editIncidentMode: {
            type: Boolean,
            default: false,
        },
        incident: {
            type: Object,
            default: null,
        },
        editMode: {
            type: Boolean,
            default: false,
        },
    },

    emits: [
        "update:incident",
        "post-incident",
        "cancel-incident",
        "resolve-incident",
        "edit-incident",
        "delete-incident",
    ],

    methods: {
        sanitizeMarkdown,

        /**
         * Get the relative time difference of a date from now
         * @param {any} date Date to get time difference
         * @returns {string} Time difference
         */
        dateFromNow(date) {
            return dayjs.utc(date).fromNow();
        },
    },
};
</script>

<style lang="scss" scoped>
.incident {
    .content {
        &[contenteditable="true"] {
            min-height: 60px;
        }
    }

    .date {
        font-size: 12px;
    }
}
</style>
