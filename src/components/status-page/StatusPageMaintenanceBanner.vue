<template>
    <template v-if="maintenanceList.length > 0">
        <div
            v-for="maintenance in maintenanceList"
            :key="maintenance.id"
            class="shadow-box alert mb-4 p-3 bg-maintenance mt-4 position-relative"
            role="alert"
        >
            <h4 class="alert-heading">{{ maintenance.title }}</h4>
            <!-- eslint-disable-next-line vue/no-v-html-->
            <div class="content" v-html="maintenanceHTML(maintenance.description)"></div>
            <MaintenanceTime :maintenance="maintenance" />
        </div>
    </template>
</template>

<script>
import MaintenanceTime from "@/components/MaintenanceTime.vue";
import { sanitizeMarkdown } from "@/util/markdown-sanitize";

export default {
    components: {
        MaintenanceTime,
    },

    props: {
        maintenanceList: {
            type: Array,
            required: true,
        },
    },

    methods: {
        /**
         * Generate sanitized HTML from maintenance description
         * @param {string} description Text to sanitize
         * @returns {string} Sanitized HTML
         */
        maintenanceHTML(description) {
            return sanitizeMarkdown(description);
        },
    },
};
</script>

<style lang="scss" scoped>
.bg-maintenance {
    .alert-heading {
        font-weight: bold;
    }
}
</style>
