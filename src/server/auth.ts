// @ts-nocheck

/**
 * Login to web app
 * @param {string} username Username to login with
 * @param {string} password Password to login with
 * @returns {Promise<(Bean|null)>} User or null if login failed
 */
import passwordHash from "@/server/password-hash";
import { R } from "@/server/bun-sqlite-store";
import { log } from "@/util";
import { loginRateLimiter, apiRateLimiter } from "@/server/rate-limiter";
import { Settings } from "@/server/settings";
import dayjs from "dayjs";
import { textResponse } from "@/server/bun-response";

export async function login(username, password) {
    if (typeof username !== "string" || typeof password !== "string") {
        return null;
    }

    let user = await R.findOne("user", "TRIM(username) = ? AND active = 1 ", [username.trim()]);

    if (user && (await passwordHash.verify(password, user.password))) {
        // Upgrade legacy or non-native password hashes after successful login.
        if (passwordHash.needRehash(user.password)) {
            await R.exec("UPDATE `user` SET password = ? WHERE id = ? ", [
                await passwordHash.generate(password),
                user.id,
            ]);
        }
        return user;
    }

    return null;
}

/**
 * Validate a provided API key
 * @param {string} key API key to verify
 * @returns {boolean} API is ok?
 */
async function verifyAPIKey(key) {
    if (typeof key !== "string") {
        return false;
    }

    // uk prefix + key ID is before _
    let index = key.substring(2, key.indexOf("_"));
    let clear = key.substring(key.indexOf("_") + 1, key.length);

    let hash = await R.findOne("api_key", " id=? ", [index]);

    if (hash === null) {
        return false;
    }

    let current = dayjs();
    let expiry = dayjs(hash.expires);
    if (expiry.diff(current) < 0 || !hash.active) {
        return false;
    }

    return hash && (await passwordHash.verify(clear, hash.key));
}

/**
 * Validate username and password credentials for HTTP Basic auth.
 * @param {string} username Username to login with
 * @param {string} password Password to login with
 * @returns {Promise<boolean>} true if authorized
 */
async function authorizeUser(username, password) {
    // Login Rate Limit
    const pass = await loginRateLimiter.pass(null, 0);
    if (!pass) {
        log.warn("basic-auth", "Failed basic auth attempt: rate limit exceeded");
        return false;
    }

    const user = await login(username, password);
    if (user !== null) {
        return true;
    }

    log.warn("basic-auth", "Failed basic auth attempt: invalid username/password");
    loginRateLimiter.removeTokens(1);
    return false;
}

/**
 * Validate an API key passed as the HTTP Basic auth password.
 * @param {string} password API key from the password field
 * @returns {Promise<boolean>} true if authorized
 */
async function authorizeAPIKey(password) {
    const pass = await apiRateLimiter.pass(null, 0);
    if (!pass) {
        log.warn("api-auth", "Failed API auth attempt: rate limit exceeded");
        return false;
    }

    const valid = await verifyAPIKey(password);
    if (!valid) {
        log.warn("api-auth", "Failed API auth attempt: invalid API Key");
    }
    // Only allow a set number of api requests per minute (currently set to 60).
    apiRateLimiter.removeTokens(1);
    return valid;
}

function parseBasicAuthRequest(request) {
    const authorization = request.headers.get("authorization");
    if (!authorization || !authorization.toLowerCase().startsWith("basic ")) {
        return null;
    }

    let decoded;
    try {
        decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    } catch {
        return null;
    }

    const separator = decoded.indexOf(":");
    if (separator === -1) {
        return null;
    }

    return {
        username: decoded.slice(0, separator),
        password: decoded.slice(separator + 1),
    };
}

function unauthorizedResponse(disableFrameSameOrigin) {
    return textResponse("Unauthorized", {
        status: 401,
        disableFrameSameOrigin,
        headers: {
            "WWW-Authenticate": 'Basic realm="Uptime Kuma"',
        },
    });
}

/**
 * Check a Bun Request with HTTP Basic auth.
 * @param {Request} request Bun request
 * @param {object} options Auth options
 * @param {boolean} options.apiKeys Use API key auth when enabled
 * @param {boolean} options.disableFrameSameOrigin Disable SAMEORIGIN frame header
 * @returns {Promise<Response|null>} null when authorized, otherwise an auth response
 */
export async function checkBasicAuthRequest(request, options = {}) {
    const disabledAuth = await Settings.get("disableAuth");
    if (disabledAuth) {
        return null;
    }

    const credentials = parseBasicAuthRequest(request);
    if (!credentials) {
        return unauthorizedResponse(options.disableFrameSameOrigin);
    }

    let authorized;
    if (options.apiKeys && (await Settings.get("apiKeysEnabled"))) {
        authorized = await authorizeAPIKey(credentials.password);
    } else {
        authorized = await authorizeUser(credentials.username, credentials.password);
    }

    return authorized ? null : unauthorizedResponse(options.disableFrameSameOrigin);
}

/**
 * Check HTTP API auth, using API keys when they are enabled.
 * @param {Request} request Bun request
 * @param {object} options Auth options
 * @returns {Promise<Response|null>} null when authorized, otherwise an auth response
 */
export async function checkAPIAuthRequest(request, options = {}) {
    return checkBasicAuthRequest(request, {
        ...options,
        apiKeys: true,
    });
}
