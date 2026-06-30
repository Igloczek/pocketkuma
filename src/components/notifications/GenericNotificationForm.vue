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
import HiddenInput from "@/components/HiddenInput.vue";
import TemplatedInput from "@/components/TemplatedInput.vue";
import TemplatedTextarea from "@/components/TemplatedTextarea.vue";
import ToggleSection from "@/components/ToggleSection.vue";

const FieldBlock = {
    name: "FieldBlock",
    components: {
        HiddenInput,
        TemplatedInput,
        TemplatedTextarea,
    },
    props: {
        field: { type: Object, required: true },
        notification: { type: Object, required: true },
        headersVisible: { type: Object, required: true },
        headersPlaceholder: { type: String, required: true },
        fieldRequired: { type: Boolean, default: false },
        fieldPlaceholder: { type: String, default: undefined },
    },
    template: `
        <div v-if="field.type === 'help-i18n'" class="form-text" :class="{ 'mb-3': field.helpTextKey }">
            <i18n-t
                v-if="field.id === 'smtp-host-help'"
                tag="div"
                keypath="Either enter the hostname of the server you want to connect to or localhost if you intend to use a locally configured mail transfer agent"
            >
                <template #localhost><code>localhost</code></template>
                <template #local_mta>
                    <a href="https://wikipedia.org/wiki/Mail_Transfer_Agent" target="_blank">
                        {{ $t("locally configured mail transfer agent") }}
                    </a>
                </template>
            </i18n-t>
            <i18n-t v-else-if="field.helpI18n" :tag="field.helpI18n.tag || 'div'" :keypath="field.helpI18n.keypath">
                <a v-if="field.helpLink" :href="field.helpLink.href" target="_blank">{{ field.helpLink.linkText || field.helpLink.href }}</a>
            </i18n-t>
            <template v-if="field.helpTextKey">{{ $t(field.helpTextKey) }}</template>
        </div>
        <div v-else class="mb-3">
            <label
                v-if="field.labelKey && field.type !== 'headers' && field.type !== 'checkbox'"
                :for="field.id"
                class="form-label"
                :class="{ 'mb-2': field.type === 'url' && field.requiredMarker }"
            >
                {{ $t(field.labelKey) }}
                <span v-if="field.requiredMarker" style="color: red"><sup>*</sup></span>
            </label>

            <input
                v-if="field.type === 'url' || field.type === 'text'"
                :id="field.id"
                v-model="notification[field.key]"
                :type="field.type === 'url' ? 'url' : 'text'"
                :pattern="field.type === 'url' ? 'https?://.+' : field.pattern"
                class="form-control"
                :required="fieldRequired"
                :placeholder="fieldPlaceholder"
                :minlength="field.minlength"
                :maxlength="field.maxlength"
            />

            <input
                v-else-if="field.type === 'number'"
                :id="field.id"
                v-model="notification[field.key]"
                type="number"
                class="form-control"
                :required="fieldRequired"
                :placeholder="fieldPlaceholder"
                :min="field.min"
                :max="field.max"
                :step="field.step"
            />

            <HiddenInput
                v-else-if="field.type === 'secret'"
                :id="field.id"
                v-model="notification[field.key]"
                autocomplete="new-password"
                :required="fieldRequired"
                :placeholder="fieldPlaceholder"
            />

            <select
                v-else-if="field.type === 'select'"
                :id="field.id"
                v-model="notification[field.key]"
                class="form-select"
                :required="fieldRequired"
            >
                <option v-for="option in field.options" :key="String(option.value)" :value="option.value">
                    {{ option.labelKey ? $t(option.labelKey) : option.label }}
                </option>
            </select>

            <textarea
                v-else-if="field.type === 'textarea'"
                :id="field.id"
                v-model="notification[field.key]"
                class="form-control"
                rows="5"
                :required="fieldRequired"
                :placeholder="fieldPlaceholder"
            ></textarea>

            <TemplatedInput
                v-else-if="field.type === 'template-input'"
                :id="field.id"
                v-model="notification[field.key]"
                :required="fieldRequired"
                :placeholder="fieldPlaceholder || ''"
            />

            <TemplatedTextarea
                v-else-if="field.type === 'template-textarea'"
                :id="field.id"
                v-model="notification[field.key]"
                :required="fieldRequired"
                :placeholder="fieldPlaceholder || ''"
            />

            <template v-else-if="field.type === 'headers'">
                <div class="form-check form-switch">
                    <input v-model="headersVisible[field.key]" class="form-check-input" type="checkbox" />
                    <label class="form-check-label">{{ $t(field.labelKey) }}</label>
                </div>
                <i18n-t
                    v-if="field.helpTextKey && headersVisible[field.key]"
                    tag="div"
                    :keypath="field.helpTextKey"
                    class="form-text mb-3"
                >
                    <a href="https://nodemailer.com/message/custom-headers" target="_blank">{{ $t("documentation") }}</a>
                </i18n-t>
                <textarea
                    v-if="headersVisible[field.key]"
                    :id="field.id"
                    v-model="notification[field.key]"
                    class="form-control headers-textarea"
                    :placeholder="headersPlaceholder"
                    :required="fieldRequired"
                ></textarea>
            </template>

            <template v-else-if="field.type === 'checkbox'">
                <div class="form-check" :class="{ 'form-switch': field.key === 'smtpIgnoreTLSError' }">
                    <input
                        :id="field.id"
                        v-model="notification[field.key]"
                        class="form-check-input"
                        type="checkbox"
                    />
                    <label class="form-check-label" :for="field.id">{{ $t(field.labelKey) }}</label>
                </div>
            </template>

            <div v-if="field.helpTextKey && field.type !== 'headers' && field.type !== 'checkbox'" class="form-text">
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
    `,
    data() {
        return {
            moreInfoStyle: { marginTop: "8px" },
        };
    },
};

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

<style lang="scss" scoped>
.headers-textarea {
    min-height: 200px;
}
</style>
