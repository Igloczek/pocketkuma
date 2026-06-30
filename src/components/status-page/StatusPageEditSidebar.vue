<template>
    <div
        class="sidebar"
        data-testid="edit-sidebar"
        :data-editable-config-ready="editableConfigReady ? 'true' : 'false'"
    >
        <div class="sidebar-body">
            <div class="my-3">
                <label for="slug" class="form-label">{{ $t("Slug") }}</label>
                <div class="input-group">
                    <span id="basic-addon3" class="input-group-text">/status/</span>
                    <input id="slug" v-model="config.slug" type="text" class="form-control" />
                </div>
            </div>

            <div class="my-3">
                <label for="title" class="form-label">{{ $t("Title") }}</label>
                <input id="title" v-model="config.title" type="text" class="form-control" />
            </div>

            <div class="my-3">
                <label for="description" class="form-label">{{ $t("Description") }}</label>
                <textarea
                    id="description"
                    v-model="config.description"
                    class="form-control"
                    data-testid="description-input"
                ></textarea>
                <div class="form-text">{{ $t("markdownSupported") }}</div>
            </div>

            <div class="my-3">
                <label for="footer-text" class="form-label">{{ $t("Footer Text") }}</label>
                <textarea
                    id="footer-text"
                    v-model="config.footerText"
                    class="form-control"
                    data-testid="footer-text-input"
                ></textarea>
                <div class="form-text">{{ $t("markdownSupported") }}</div>
            </div>

            <div class="my-3">
                <label for="auto-refresh-interval" class="form-label">{{ $t("Refresh Interval") }}</label>
                <input
                    id="auto-refresh-interval"
                    v-model="config.autoRefreshInterval"
                    type="number"
                    class="form-control"
                    :min="5"
                    data-testid="refresh-interval-input"
                />
                <div class="form-text">
                    {{ $t("Refresh Interval Description", [config.autoRefreshInterval]) }}
                </div>
            </div>

            <div class="my-3">
                <label for="switch-theme" class="form-label">{{ $t("Theme") }}</label>
                <select id="switch-theme" v-model="config.theme" class="form-select" data-testid="theme-select">
                    <option value="auto">{{ $t("Auto") }}</option>
                    <option value="light">{{ $t("Light") }}</option>
                    <option value="dark">{{ $t("Dark") }}</option>
                </select>
            </div>

            <div class="my-3 form-check form-switch">
                <input
                    id="showTags"
                    v-model="config.showTags"
                    class="form-check-input"
                    type="checkbox"
                    data-testid="show-tags-checkbox"
                />
                <label class="form-check-label" for="showTags">{{ $t("Show Tags") }}</label>
            </div>

            <div class="my-3 form-check form-switch">
                <input
                    id="show-powered-by"
                    v-model="config.showPoweredBy"
                    class="form-check-input"
                    type="checkbox"
                    data-testid="show-powered-by-checkbox"
                />
                <label class="form-check-label" for="show-powered-by">{{ $t("Show Powered By") }}</label>
            </div>

            <div class="my-3 form-check form-switch">
                <input
                    id="show-certificate-expiry"
                    v-model="config.showCertificateExpiry"
                    class="form-check-input"
                    type="checkbox"
                    data-testid="show-certificate-expiry-checkbox"
                />
                <label class="form-check-label" for="show-certificate-expiry">
                    {{ $t("showCertificateExpiry") }}
                </label>
            </div>

            <div class="my-3 form-check form-switch">
                <input
                    id="show-only-last-heartbeat"
                    v-model="config.showOnlyLastHeartbeat"
                    class="form-check-input"
                    type="checkbox"
                />
                <label class="form-check-label" for="show-only-last-heartbeat">
                    {{ $t("showOnlyLastHeartbeat") }}
                </label>
            </div>

            <div class="my-3">
                <label class="form-label">
                    {{ $t("Domain Names") }}
                    <button
                        class="p-0 bg-transparent border-0"
                        :aria-label="$t('Add a domain')"
                        @click="$emit('add-domain')"
                    >
                        <font-awesome-icon icon="plus-circle" class="action text-primary" />
                    </button>
                </label>

                <ul class="list-group domain-name-list">
                    <li v-for="(domain, index) in config.domainNameList" :key="index" class="list-group-item">
                        <input
                            v-model="config.domainNameList[index]"
                            type="text"
                            class="no-bg domain-input"
                            placeholder="example.com"
                        />
                        <button
                            class="p-0 bg-transparent border-0"
                            :aria-label="$t('Remove domain', [domain])"
                            @click="$emit('remove-domain', index)"
                        >
                            <font-awesome-icon icon="times" class="action remove ms-2 me-3 text-danger" />
                        </button>
                    </li>
                </ul>
            </div>

            <div class="my-3">
                <label for="analyticsType" class="form-label">{{ $t("Analytics Type") }}</label>
                <select
                    id="analyticsType"
                    v-model="config.analyticsType"
                    class="form-select"
                    data-testid="analytics-type-select"
                >
                    <option :value="null">{{ $t("None") }}</option>
                    <option value="google">Google</option>
                    <option value="umami">Umami</option>
                    <option value="plausible">Plausible</option>
                    <option value="matomo">Matomo</option>
                    <option value="rybbit">Rybbit</option>
                </select>
            </div>

            <div v-if="!!config.analyticsType" class="my-3">
                <label for="analyticsId" class="form-label">{{ $t("Analytics ID") }}</label>
                <input
                    id="analyticsId"
                    v-model="config.analyticsId"
                    type="text"
                    class="form-control"
                    data-testid="analytics-id-input"
                />
            </div>

            <div v-if="!!config.analyticsType && config.analyticsType !== 'google'" class="my-3">
                <label for="analyticsScriptUrl" class="form-label">{{ $t("Analytics Script URL") }}</label>
                <input
                    id="analyticsScriptUrl"
                    v-model="config.analyticsScriptUrl"
                    type="url"
                    class="form-control"
                    data-testid="analytics-script-url-input"
                />
            </div>

            <div class="my-3">
                <label for="rss-title" class="form-label">{{ $t("RSS Title") }}</label>
                <input
                    id="rss-title"
                    v-model="config.rssTitle"
                    type="text"
                    class="form-control"
                    data-testid="rss-title-input"
                />
                <div class="form-text">
                    {{ $t("Leave blank to use status page title") }}
                </div>
            </div>

            <div class="my-3">
                <div class="mb-1">{{ $t("Custom CSS") }}</div>
                <prism-editor
                    v-model="config.customCSS"
                    class="css-editor"
                    data-testid="custom-css-input"
                    :highlight="highlighter"
                    line-numbers
                ></prism-editor>
            </div>

            <div class="danger-zone">
                <button class="btn btn-danger me-2" @click="$emit('delete')">
                    <font-awesome-icon icon="trash" />
                    {{ $t("Delete") }}
                </button>
            </div>
        </div>

        <div class="sidebar-footer">
            <button class="btn btn-success me-2" :disabled="loading" data-testid="save-button" @click="$emit('save')">
                <font-awesome-icon icon="save" />
                {{ $t("Save") }}
            </button>

            <button class="btn btn-danger me-2" @click="$emit('discard')">
                <font-awesome-icon icon="undo" />
                {{ $t("Discard") }}
            </button>
        </div>
    </div>
</template>

<script>
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-css";
import "prismjs/themes/prism-tomorrow.css";
import { PrismEditor } from "vue-prism-editor";
import "vue-prism-editor/dist/prismeditor.min.css";

export default {
    components: {
        PrismEditor,
    },

    props: {
        config: {
            type: Object,
            required: true,
        },
        editableConfigReady: {
            type: Boolean,
            default: false,
        },
        loading: {
            type: Boolean,
            default: false,
        },
    },

    emits: ["add-domain", "remove-domain", "delete", "save", "discard"],

    methods: {
        /**
         * Provide syntax highlighting for CSS
         * @param {string} code Text to highlight
         * @returns {string} Highlighted CSS
         */
        highlighter(code) {
            return highlight(code, languages.css);
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.sidebar {
    position: fixed;
    left: 0;
    top: 0;
    width: 300px;
    height: 100vh;

    border-right: 1px solid #ededed;

    .danger-zone {
        border-top: 1px solid #ededed;
        padding-top: 15px;
    }

    .sidebar-body {
        padding: 0 10px 10px 10px;
        overflow-x: hidden;
        overflow-y: auto;
        height: calc(100% - 70px);
    }

    .sidebar-footer {
        border-top: 1px solid #ededed;
        border-right: 1px solid #ededed;
        padding: 10px;
        width: 300px;
        height: 70px;
        position: fixed;
        left: 0;
        bottom: 0;
        background-color: white;
        display: flex;
        align-items: center;
    }
}

.dark {
    .sidebar {
        background-color: $dark-header-bg;
        border-right-color: $dark-border-color;

        .danger-zone {
            border-top-color: $dark-border-color;
        }

        .sidebar-footer {
            border-right-color: $dark-border-color;
            border-top-color: $dark-border-color;
            background-color: $dark-header-bg;
        }
    }
}

.domain-name-list {
    li {
        display: flex;
        align-items: center;
        padding: 10px 0 10px 10px;

        .domain-input {
            flex-grow: 1;
            background-color: transparent;
            border: none;
            color: $dark-font-color;
            outline: none;

            &::placeholder {
                color: #1d2634;
            }
        }
    }
}
</style>
