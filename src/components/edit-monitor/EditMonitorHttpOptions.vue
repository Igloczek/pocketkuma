<template>
<!-- HTTP Options -->
<template
    v-if="
        monitor.type === 'http' ||
        monitor.type === 'keyword' ||
        monitor.type === 'json-query'
    "
>
    <h2 class="mt-5 mb-2">{{ $t("HTTP Options") }}</h2>
    <!-- Method -->
    <div class="my-3">
        <label for="method" class="form-label">{{ $t("Method") }}</label>
        <select id="method" v-model="monitor.method" class="form-select">
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
            <option value="HEAD">HEAD</option>
            <option value="OPTIONS">OPTIONS</option>
        </select>
    </div>
    <!-- Encoding -->
    <div class="my-3">
        <label for="httpBodyEncoding" class="form-label">{{ $t("Body Encoding") }}</label>
        <select
            id="httpBodyEncoding"
            v-model="monitor.httpBodyEncoding"
            class="form-select"
        >
            <option value="json">JSON</option>
            <option value="form">x-www-form-urlencoded</option>
            <option value="xml">XML</option>
        </select>
    </div>
    <!-- Body -->
    <div class="my-3">
        <label for="body" class="form-label">{{ $t("Body") }}</label>
        <textarea
            id="body"
            v-model="monitor.body"
            class="form-control"
            :placeholder="bodyPlaceholder"
        ></textarea>
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
    <template v-if="monitor.authMethod && monitor.authMethod !== null">
        <template v-if="monitor.authMethod === 'mtls'">
            <div class="alert alert-warning my-3">
                mTLS authentication is not supported by the Bun fetch HTTP client. Choose
                another authentication method to restore monitoring.
            </div>
            <div class="my-3">
                <label for="tls-cert" class="form-label">
                    {{ $t("mtls-auth-server-cert-label") }}
                </label>
                <textarea
                    id="tls-cert"
                    v-model="monitor.tlsCert"
                    class="form-control"
                    :placeholder="$t('mtls-auth-server-cert-placeholder')"
                    required
                ></textarea>
            </div>
            <div class="my-3">
                <label for="tls-key" class="form-label">
                    {{ $t("mtls-auth-server-key-label") }}
                </label>
                <textarea
                    id="tls-key"
                    v-model="monitor.tlsKey"
                    class="form-control"
                    :placeholder="$t('mtls-auth-server-key-placeholder')"
                    required
                ></textarea>
            </div>
            <div class="my-3">
                <label for="tls-ca" class="form-label">
                    {{ $t("mtls-auth-server-ca-label") }}
                </label>
                <textarea
                    id="tls-ca"
                    v-model="monitor.tlsCa"
                    class="form-control"
                    :placeholder="$t('mtls-auth-server-ca-placeholder')"
                ></textarea>
            </div>
        </template>
        <template v-else-if="monitor.authMethod === 'bearer'">
            <div class="my-3">
                <label for="bearer-token" class="form-label">{{ $t("Token") }}</label>
                <HiddenInput
                    id="bearer-token"
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
                <label for="oauth_client_id" class="form-label">
                    {{ $t("Client ID") }}
                </label>
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
                    <HiddenInput
                        id="oauth_client_secret"
                        v-model="monitor.oauth_client_secret"
                        :placeholder="$t('Client Secret')"
                        :required="true"
                    />
                </div>
                <div class="my-3">
                    <label for="oauth_scopes" class="form-label">
                        {{ $t("OAuth Scope") }}
                    </label>
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
        <template v-else>
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
                <HiddenInput
                    id="basicauth-pass"
                    v-model="monitor.basic_auth_pass"
                    autocomplete="new-password"
                    :placeholder="$t('Password')"
                />
            </div>
            <div v-if="monitor.authMethod === 'ntlm'" class="alert alert-warning my-3">
                NTLM authentication is no longer supported. Choose another authentication
                method to restore monitoring.
            </div>
        </template>
    </template>
</template>
</template>

<script>
import HiddenInput from "@/components/HiddenInput.vue";

export default {
    name: "EditMonitorHttpOptions",

    components: {
        HiddenInput,
    },

    props: {
        monitor: {
            type: Object,
            required: true,
        },
        bodyPlaceholder: {
            type: String,
            required: true,
        },
        headersPlaceholder: {
            type: String,
            required: true,
        },
    },
};
</script>
