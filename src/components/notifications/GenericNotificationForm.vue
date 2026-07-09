<template>
    <template v-for="field in visibleFields" :key="field.id">
        <ToggleSection v-if="field.type === 'section'" :heading="$t(field.labelKey)">
            <i18n-t
                v-if="field.helpI18n"
                :tag="field.helpI18n.tag || 'div'"
                :keypath="field.helpI18n.keypath"
                class="form-text mb-3"
            >
                <a v-if="field.helpLink" :href="field.helpLink.href" target="_blank">
                    {{ $t("documentation") }}
                </a>
            </i18n-t>
            <template v-for="sectionField in field.fields" :key="sectionField.id">
                <FieldBlock
                    :field="sectionField"
                    :notification="notification"
                    :headers-visible="headersVisible"
                    :headers-placeholder="headersPlaceholder"
                    :field-required="isFieldRequired(sectionField)"
                    :field-placeholder="fieldPlaceholder(sectionField)"
                />
            </template>
        </ToggleSection>

        <FieldBlock
            v-else
            :field="field"
            :notification="notification"
            :headers-visible="headersVisible"
            :headers-placeholder="headersPlaceholder"
            :field-required="isFieldRequired(field)"
            :field-placeholder="fieldPlaceholder(field)"
        />
    </template>
</template>

<script>
import ToggleSection from "@/components/ToggleSection.vue";
import FieldBlock from "@/components/notifications/GenericNotificationField.vue";

export default {
    components: {
        FieldBlock,
        ToggleSection,
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
        };
    },
    computed: {
        notification() {
            return this.$parent.notification;
        },
        headersPlaceholder() {
            const example =
                this.schema.variant === "smtp"
                    ? `{
    "X-Custom-Header": "Additional Header"
}`
                    : `{
    "Authorization": "Authorization Token"
}`;

            return this.$t("Example:", [example]);
        },
        hasRecipient() {
            if (!this.schema.recipientGroupKeys) {
                return false;
            }

            return this.schema.recipientGroupKeys.some((key) => !!this.notification[key]);
        },
        visibleFields() {
            return this.schema.fields.filter((field) => this.isFieldVisible(field));
        },
    },
    methods: {
        isFieldVisible(field) {
            if (!field.visibleWhen) {
                return true;
            }

            const currentValue = this.notification[field.visibleWhen.field];

            if (field.visibleWhen.equals !== undefined) {
                return currentValue === field.visibleWhen.equals;
            }

            if (field.visibleWhen.notEquals !== undefined) {
                return currentValue !== field.visibleWhen.notEquals;
            }

            return true;
        },
        isFieldRequired(field) {
            if (field.requiredUnlessRecipientGroup) {
                return !this.hasRecipient;
            }

            return field.required !== false;
        },
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
                if (this.notification[key] === undefined) {
                    this.notification[key] = value;
                }
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
