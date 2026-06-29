// @ts-nocheck

function base64UrlEncode(bytes) {
    const binary = String.fromCharCode(...bytes);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(str) {
    let normalized = str.replace(/-/g, "+").replace(/_/g, "/");
    while (normalized.length % 4 !== 0) {
        normalized += "=";
    }
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function encodePart(value) {
    return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function signHmacSha256(signingInput, secret) {
    const hasher = new Bun.CryptoHasher("sha256", secret);
    hasher.update(signingInput);
    return hasher.digest();
}

/**
 * Sign a JWT payload with HS256.
 * @param {unknown} payload JWT payload.
 * @param {string} secret Signing secret.
 * @param {object} options Optional signing options.
 * @returns {string} Signed JWT.
 */
function sign(payload, secret, options = {}) {
    const header = { alg: "HS256", typ: "JWT", ...(options.header || {}) };
    const encodedHeader = encodePart(header);
    const encodedPayload = encodePart(payload);
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = signHmacSha256(signingInput, secret);
    return `${signingInput}.${base64UrlEncode(signature)}`;
}

/**
 * Verify a JWT and return its payload.
 * @param {string} token JWT to verify.
 * @param {string} secret Signing secret.
 * @returns {object} Decoded payload.
 */
function verify(token, secret) {
    const parts = token.split(".");
    if (parts.length !== 3) {
        throw new Error("jwt malformed");
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedHeader)));

    if (!header || header.alg !== "HS256") {
        throw new Error("invalid algorithm");
    }

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expected = signHmacSha256(signingInput, secret);
    const actual = base64UrlDecode(encodedSignature);

    if (expected.length !== actual.length) {
        throw new Error("invalid signature");
    }

    let valid = 0;
    for (let i = 0; i < expected.length; i++) {
        valid |= expected[i] ^ actual[i];
    }

    if (valid !== 0) {
        throw new Error("invalid signature");
    }

    return JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));
}

export { sign, verify };

export default { sign, verify };
