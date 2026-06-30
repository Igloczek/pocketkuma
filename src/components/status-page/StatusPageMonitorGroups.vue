<template>
    <div>
        <strong v-if="editMode">{{ $t("Description") }}:</strong>
        <Editable
            v-if="enableEditMode"
            :model-value="description"
            :contenteditable="editMode"
            tag="div"
            class="mb-4 description"
            data-testid="description-editable"
            @update:model-value="$emit('update:description', $event)"
        />
        <!-- eslint-disable vue/no-v-html-->
        <div v-if="!enableEditMode" class="alert-heading p-2" data-testid="description" v-html="descriptionHTML"></div>
        <!-- eslint-enable vue/no-v-html-->

        <div v-if="editMode" class="mb-4">
            <div>
                <button
                    class="btn btn-primary btn-add-group me-2"
                    data-testid="add-group-button"
                    @click="$emit('add-group')"
                >
                    <font-awesome-icon icon="plus" />
                    {{ $t("Add Group") }}
                </button>
            </div>

            <div class="mt-3">
                <div v-if="sortedMonitorList.length > 0 && loadedData">
                    <label>{{ $t("Add a monitor") }}:</label>
                    <VueMultiselect
                        :model-value="selectedMonitor"
                        :options="sortedMonitorList"
                        :multiple="false"
                        :searchable="true"
                        :placeholder="$t('Add a monitor')"
                        label="name"
                        trackBy="name"
                        class="mt-3"
                        data-testid="monitor-select"
                        @update:model-value="$emit('update:selectedMonitor', $event)"
                    >
                        <template #option="{ option }">
                            <div class="d-inline-flex">
                                <span>
                                    {{ option.pathName }}
                                    <Tag v-for="tag in option.tags" :key="tag" :item="tag" :size="'sm'" />
                                </span>
                            </div>
                        </template>
                    </VueMultiselect>
                </div>
                <div v-else class="text-center">
                    {{ $t("No monitors available.") }}
                    <router-link to="/add">{{ $t("Add one") }}</router-link>
                </div>
            </div>
        </div>

        <div class="mb-4">
            <div v-if="$root.publicGroupList.length === 0 && loadedData" class="text-center">
                👀 {{ $t("statusPageNothing") }}
            </div>

            <PublicGroupList
                :edit-mode="enableEditMode"
                :show-tags="showTags"
                :show-certificate-expiry="showCertificateExpiry"
                :show-only-last-heartbeat="showOnlyLastHeartbeat"
            />
        </div>
    </div>
</template>

<script>
import PublicGroupList from "@/components/PublicGroupList.vue";
import Tag from "@/components/Tag.vue";
import VueMultiselect from "vue-multiselect";
import { sanitizeMarkdown } from "@/util/markdown-sanitize";

export default {
    components: {
        PublicGroupList,
        Tag,
        VueMultiselect,
    },

    props: {
        loadedData: {
            type: Boolean,
            default: false,
        },
        enableEditMode: {
            type: Boolean,
            default: false,
        },
        editMode: {
            type: Boolean,
            default: false,
        },
        description: {
            type: String,
            default: "",
        },
        showTags: {
            type: Boolean,
            default: false,
        },
        showCertificateExpiry: {
            type: Boolean,
            default: false,
        },
        showOnlyLastHeartbeat: {
            type: Boolean,
            default: false,
        },
        sortedMonitorList: {
            type: Array,
            default: () => [],
        },
        selectedMonitor: {
            type: Object,
            default: null,
        },
    },

    emits: ["update:description", "update:selectedMonitor", "add-group"],

    computed: {
        descriptionHTML() {
            return sanitizeMarkdown(this.description);
        },
    },
};
</script>

<style lang="scss" scoped>
.description span {
    min-width: 50px;
}
</style>
