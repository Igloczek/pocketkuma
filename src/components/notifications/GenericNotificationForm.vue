<template>
    <template v-for="field in schema.fields" :key="field.id">
        <div class="mb-3">
            <label :for="field.id" class="form-label" :class="{ 'mb-2': field.type === 'url' && field.requiredMarker }">
                {{ $t(field.labelKey) }}
                <span v-if="field.requiredMarker" style="color: red"><sup>*</sup></span>
            </label>

            <input
                v-if="field.type === 'url' || field.type === 'text'"
                :id="field.id"
                v-model="notification[field.key]"
                :type="field.type === 'url' ? 'url' : 'text'"
                :pattern="field.type === 'url' ? 'https?://.+' : undefined"
                class="form-control"
                :required="field.required"
                :placeholder="fieldPlaceholder(field)"
            />

            <HiddenInput
                v-else-if="field.type === 'secret'"
                :id="field.id"
                v-model="notification[field.key]"
                autocomplete="new-password"
                :required="field.required"
                :placeholder="fieldPlaceholder(field)"
            />

            <select
                v-else-if="field.type === 'select'"
                :id="field.id"
                v-model="notification[field.key]"
                class="form-select"
                :required="field.required"
            >
                <option v-for="option in field.options" :key="option.value" :value="option.value">
                    {{ option.label }}
                </option>
            </select>

            <template v-else-if="field.type === 'headers'">
                <div class="form-check form-switch">
                    <input v-model="headersVisible[field.key]" class="form-check-input" type="checkbox" />
                    <label class="form-check-label">{{ $t(field.labelKey) }}</label>
                </div>
                <div v-if="field.helpTextKey" class="form-text">{{ $t(field.helpTextKey) }}</div>
                <textarea
                    v-if="headersVisible[field.key]"
                    :id="field.id"
                    v-model="notification[field.key]"
                    class="form-control headers-textarea"
                    :placeholder="headersPlaceholder"
                    :required="field.required"
                ></textarea>
            </template>

            <div v-if="field.helpTextKey && field.type !== 'headers'" class="form-text">
                <p v-if="field.requiredMarker">
                    <span style="color: red"><sup>*</sup></span>
                    {{ $t(field.helpTextKey) }}
                </p>
                <template v-else>
                    {{ $t(field.helpTextKey) }}
                </template>
            </div>

            <i18n-t v-if="field.helpLink" tag="div" :keypath="field.helpLink.keypath" class="form-text">
                <a :href="field.helpLink.href" target="_blank">
                    {{
                        field.helpLink.linkTextKey
                            ? $t(field.helpLink.linkTextKey)
                            : field.helpLink.linkText || field.helpLink.href
                    }}
                </a>
            </i18n-t>

            <i18n-t v-if="field.moreInfoLink" tag="p" keypath="More info on:" :style="moreInfoStyle">
                <a :href="field.moreInfoLink.href" rel="noopener noreferrer" target="_blank">
                    {{ field.moreInfoLink.href }}
                </a>
            </i18n-t>

            <a v-if="field.documentationLink" :href="field.documentationLink.href" target="_blank">
                {{ $t(field.documentationLink.labelKey, field.documentationLink.labelArgs) }}
            </a>
        </div>
    </template>
</template>

<script>
import HiddenInput from "@/components/HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    props: {
        schema: {
            type: Object,
            required: true,
        },
    },
    data() {
        const headersVisible = {};

        for (const field of this.schema.fields) {
            if (field.type === "headers") {
                headersVisible[field.key] = this.$parent.notification[field.key] != null;
            }
        }

        return {
            headersVisible,
            moreInfoStyle: { marginTop: "8px" },
        };
    },
    computed: {
        notification() {
            return this.$parent.notification;
        },
        headersPlaceholder() {
            return this.$t("Example:", [
                `{
    "Authorization": "Authorization Token"
}`,
            ]);
        },
    },
    methods: {
        fieldPlaceholder(field) {
            if (field.placeholder) {
                return field.placeholder;
            }

            if (field.placeholderKey) {
                return this.$t(field.placeholderKey);
            }

            return undefined;
        },
    },
    mounted() {
        if (this.schema.defaults) {
            for (const [key, value] of Object.entries(this.schema.defaults)) {
                this.notification[key] ||= value;
            }
        }

        for (const field of this.schema.fields) {
            if (field.defaultValue !== undefined && this.notification[field.key] === undefined) {
                this.notification[field.key] = field.defaultValue;
            }
        }
    },
};
</script>

<style lang="scss" scoped>
.headers-textarea {
    min-height: 200px;
}
</style>
