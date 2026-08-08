const DEFAULT_TIMEOUT_MS = 10_000;

function formValue(value) {
    return encodeURIComponent(String(value)).replace(/%20/g, "+");
}

function normalizeTimeout(timeout) {
    const value = Number(timeout);
    return Number.isFinite(value) && value > 0 ? Math.ceil(value) : DEFAULT_TIMEOUT_MS;
}

function tokenEndpointUrl(tokenEndpoint) {
    try {
        const url = new URL(tokenEndpoint);
        if (url.protocol === "http:" || url.protocol === "https:") {
            return url;
        }
    } catch {
        // Use the same safe error for malformed and unsupported URLs.
    }

    throw new Error("OAuth token endpoint must be an absolute HTTP(S) URL");
}

function parseJson(body) {
    try {
        return JSON.parse(body);
    } catch {
        return undefined;
    }
}

function oauthError(body) {
    const json = parseJson(body);
    if (!json?.error) {
        return undefined;
    }

    return `${json.error}${json.error_description ? ` (${json.error_description})` : ""}`;
}

/**
 * Requests an OAuth 2.0 client-credentials access token.
 * @returns {Promise<object>} The token response with expires_at when expires_in is present.
 */
export async function getOAuthClientCredentialsToken(
    tokenEndpoint,
    clientId,
    clientSecret,
    scope,
    audience,
    authMethod = "client_secret_basic",
    timeout = DEFAULT_TIMEOUT_MS
) {
    if (typeof clientId !== "string" || !clientId) {
        throw new Error("OAuth client ID must be a non-empty string");
    }
    if (typeof clientSecret !== "string") {
        throw new Error("OAuth client secret must be a string");
    }

    const url = tokenEndpointUrl(tokenEndpoint);
    const timeoutMs = normalizeTimeout(timeout);
    const form = new URLSearchParams({ grant_type: "client_credentials" });

    if (scope) {
        form.set("scope", scope);
    }
    if (audience) {
        form.set("audience", audience);
    }

    const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    };

    if (authMethod === "client_secret_basic") {
        headers.Authorization = `Basic ${Buffer.from(`${formValue(clientId)}:${formValue(clientSecret)}`).toString("base64")}`;
    } else if (authMethod === "client_secret_post") {
        form.set("client_id", clientId);
        form.set("client_secret", clientSecret);
    } else {
        throw new Error(`Unsupported OAuth client authentication method: ${authMethod}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    let body;
    try {
        response = await fetch(url, {
            method: "POST",
            headers,
            body: form,
            redirect: "manual",
            signal: controller.signal,
        });
        body = await response.text();
    } catch (error) {
        if (controller.signal.aborted) {
            throw new Error(`OAuth token request timed out after ${timeoutMs}ms`, { cause: error });
        }
        throw new Error(`OAuth token request failed: ${error.message}`, { cause: error });
    } finally {
        clearTimeout(timeoutId);
    }

    const error = oauthError(body);
    if (error) {
        throw new Error(error);
    }
    if (response.status !== 200) {
        throw new Error(`expected 200 OK, got: ${response.status} ${response.statusText}`);
    }

    const token = parseJson(body);
    if (!token || typeof token !== "object") {
        throw new Error("OAuth token endpoint returned a non-JSON response");
    }
    if (typeof token.access_token !== "string" || !token.access_token) {
        throw new Error("OAuth token response did not include an access_token");
    }

    if (token.expires_in === undefined) {
        return token;
    }

    const expiresIn = Number(token.expires_in);
    if (!Number.isFinite(expiresIn) || expiresIn < 0) {
        throw new Error("OAuth token response has an invalid expires_in value");
    }

    return {
        ...token,
        expires_at: Math.floor(Date.now() / 1000) + Math.floor(expiresIn),
    };
}
