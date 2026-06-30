<template>
<!-- Globalping HTTP Options -->
<template v-if="monitor.type === 'globalping' && monitor.subtype === 'http'">
    <h2 class="mt-5 mb-2">{{ $t("HTTP Options") }}</h2>
    <!-- Method -->
    <div class="my-3">
        <label for="method" class="form-label">{{ $t("Method") }}</label>
        <select id="method" v-model="monitor.method" class="form-select">
            <option value="HEAD">HEAD</option>
            <option value="GET">GET</option>
            <option value="OPTIONS">OPTIONS</option>
        </select>
    </div>
    <!-- Headers -->
    <div class="my-3">
        <label for="headers" class="form-label">{{ $t("Headers") }}</label>
        <textarea
            id="headers"
            v-model="monitor.headers"
            class="form-control"
            :placeholder="headersPlaceholder"
        ></textarea>
    </div>
    <!-- HTTP Auth -->
    <h4 class="mt-5 mb-2">{{ $t("Authentication") }}</h4>
    <!-- Method -->
    <div class="my-3">
        <label for="method" class="form-label">{{ $t("Method") }}</label>
        <select id="method" v-model="monitor.authMethod" class="form-select">
            <option :value="null">
                {{ $t("None") }}
            </option>
            <option value="basic">
                {{ $t("HTTP Basic Auth") }}
            </option>
            <option value="bearer">
                {{ $t("Bearer Token") }}
            </option>
            <option value="oauth2-cc">
                {{ $t("OAuth2: Client Credentials") }}
            </option>
        </select>
    </div>
    <template v-if="monitor.authMethod === 'basic'">
        <div class="my-3">
            <label for="basicauth-user" class="form-label">{{ $t("Username") }}</label>
            <input
                id="basicauth-user"
                v-model="monitor.basic_auth_user"
                type="text"
                class="form-control"
                :placeholder="$t('Username')"
            />
        </div>
        <div class="my-3">
            <label for="basicauth-pass" class="form-label">{{ $t("Password") }}</label>
            <input
                id="basicauth-pass"
                v-model="monitor.basic_auth_pass"
                type="password"
                autocomplete="new-password"
                class="form-control"
                :placeholder="$t('Password')"
            />
        </div>
    </template>
    <template v-else-if="monitor.authMethod === 'bearer'">
        <div class="my-3">
            <label for="bearer-token-globalping" class="form-label">
                {{ $t("Token") }}
            </label>
            <HiddenInput
                id="bearer-token-globalping"
                v-model="monitor.bearer_token"
                autocomplete="new-password"
                :placeholder="$t('Token')"
            />
        </div>
    </template>
    <template v-else-if="monitor.authMethod === 'oauth2-cc'">
        <div class="my-3">
            <label for="oauth_auth_method" class="form-label">
                {{ $t("Authentication Method") }}
            </label>
            <select
                id="oauth_auth_method"
                v-model="monitor.oauth_auth_method"
                class="form-select"
            >
                <option value="client_secret_basic">
                    {{ $t("Authorization Header") }}
                </option>
                <option value="client_secret_post">
                    {{ $t("Form Data Body") }}
                </option>
            </select>
        </div>
        <div class="my-3">
            <label for="oauth_token_url" class="form-label">
                {{ $t("OAuth Token URL") }}
            </label>
            <input
                id="oauth_token_url"
                v-model="monitor.oauth_token_url"
                type="text"
                class="form-control"
                :placeholder="$t('OAuth Token URL')"
                required
            />
        </div>
        <div class="my-3">
            <label for="oauth_client_id" class="form-label">{{ $t("Client ID") }}</label>
            <input
                id="oauth_client_id"
                v-model="monitor.oauth_client_id"
                type="text"
                class="form-control"
                :placeholder="$t('Client ID')"
                required
            />
        </div>
        <template
            v-if="
                monitor.oauth_auth_method === 'client_secret_post' ||
                monitor.oauth_auth_method === 'client_secret_basic'
            "
        >
            <div class="my-3">
                <label for="oauth_client_secret" class="form-label">
                    {{ $t("Client Secret") }}
                </label>
                <input
                    id="oauth_client_secret"
                    v-model="monitor.oauth_client_secret"
                    type="password"
                    class="form-control"
                    :placeholder="$t('Client Secret')"
                    required
                />
            </div>
            <div class="my-3">
                <label for="oauth_scopes" class="form-label">{{ $t("OAuth Scope") }}</label>
                <input
                    id="oauth_scopes"
                    v-model="monitor.oauth_scopes"
                    type="text"
                    class="form-control"
                    :placeholder="$t('Optional: Space separated list of scopes')"
                />
            </div>
            <div class="my-3">
                <label for="oauth_audience" class="form-label">
                    {{ $t("OAuth Audience") }}
                </label>
                <input
                    id="oauth_audience"
                    v-model="monitor.oauth_audience"
                    type="text"
                    class="form-control"
                    :placeholder="$t('Optional: The audience to request the JWT for')"
                />
            </div>
        </template>
    </template>
    <!-- Response -->
    <h2 class="mt-5 mb-2">{{ $t("Response") }}</h2>
    <div class="my-3">
        <label for="checkfor" class="form-label">{{ $t("Check for") }}</label>
        <select id="checkfor" v-model="monitor.responsecheck" class="form-select">
            <option :value="null">
                {{ $t("None") }}
            </option>
            <option value="keyword">
                {{ $t("Keyword") }}
            </option>
            <option value="json-query">
                {{ $t("Json Query Expression") }}
            </option>
        </select>
    </div>
    <!-- Keyword -->
    <template v-if="monitor.responsecheck === 'keyword'">
        <div class="my-3">
            <label for="keyword" class="form-label">{{ $t("Keyword") }}</label>
            <input
                id="keyword"
                v-model="monitor.keyword"
                type="text"
                class="form-control"
            />
            <div class="form-text">
                {{ $t("keywordDescription") }}
            </div>
        </div>
        <!-- Invert keyword -->
        <div class="my-3 form-check">
            <input
                id="invert-keyword"
                v-model="monitor.invertKeyword"
                class="form-check-input"
                type="checkbox"
            />
            <label class="form-check-label" for="invert-keyword">
                {{ $t("Invert Keyword") }}
            </label>
            <div class="form-text">
                {{ $t("invertKeywordDescription") }}
            </div>
        </div>
    </template>
    <!-- Json Query -->
    <template v-if="monitor.responsecheck === 'json-query'">
        <div class="my-3">
            <div class="my-2">
                <label for="jsonPath" class="form-label mb-0">
                    {{ $t("Json Query Expression") }}
                </label>
                <i18n-t tag="div" class="form-text mb-2" keypath="jsonQueryDescription">
                    <a href="https://jsonata.org/">jsonata.org</a>
                    <a href="https://try.jsonata.org/">{{ $t("playground") }}</a>
                </i18n-t>
                <input
                    id="jsonPath"
                    v-model="monitor.jsonPath"
                    type="text"
                    class="form-control"
                    placeholder="$"
                    required
                />
            </div>
            <div class="d-flex align-items-start">
                <div class="me-2">
                    <label for="json_path_operator" class="form-label">
                        {{ $t("Condition") }}
                    </label>
                    <select
                        id="json_path_operator"
                        v-model="monitor.jsonPathOperator"
                        class="form-select me-3"
                        required
                    >
                        <option value=">">&gt;</option>
                        <option value=">=">&gt;=</option>
                        <option value="<">&lt;</option>
                        <option value="<=">&lt;=</option>
                        <option value="!=">&#33;=</option>
                        <option value="==">==</option>
                        <option value="contains">contains</option>
                    </select>
                </div>
                <div class="flex-grow-1">
                    <label for="expectedValue" class="form-label">
                        {{ $t("Expected Value") }}
                    </label>
                    <input
                        v-if="
                            monitor.jsonPathOperator !== 'contains' &&
                            monitor.jsonPathOperator !== '==' &&
                            monitor.jsonPathOperator !== '!='
                        "
                        id="expectedValue"
                        v-model="monitor.expectedValue"
                        type="number"
                        class="form-control"
                        required
                        step=".01"
                    />
                    <input
                        v-else
                        id="expectedValue"
                        v-model="monitor.expectedValue"
                        type="text"
                        class="form-control"
                        required
                    />
                </div>
            </div>
        </div>
    </template>
</template>
</template>

<script>
import HiddenInput from "@/components/HiddenInput.vue";

export default {
    name: "EditMonitorGlobalpingHttpOptions",

    components: {
        HiddenInput,
    },

    props: {
        monitor: {
            type: Object,
            required: true,
        },
        headersPlaceholder: {
            type: String,
            required: true,
        },
    },
};
</script>
