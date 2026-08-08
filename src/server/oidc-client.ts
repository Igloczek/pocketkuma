import oidc from "openid-client";

export async function getOidcTokenClientCredentials(
    tokenEndpoint,
    clientId,
    clientSecret,
    scope,
    audience,
    authMethod = "client_secret_basic",
    timeout = 10000
) {
    const oauthProvider = new oidc.Issuer({ token_endpoint: tokenEndpoint });
    const client = new oauthProvider.Client({
        client_id: clientId,
        client_secret: clientSecret,
        token_endpoint_auth_method: authMethod,
    });

    client[oidc.custom.http_options] = () => ({ timeout });
    client[oidc.custom.clock_tolerance] = 5;

    const grantParams = { grant_type: "client_credentials" };
    if (scope) {
        grantParams.scope = scope;
    }
    if (audience) {
        grantParams.audience = audience;
    }

    return await client.grant(grantParams);
}
