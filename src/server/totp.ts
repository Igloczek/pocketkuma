// @ts-nocheck

import { genSecret } from "@/util";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(bytes) {
    let bits = 0;
    let value = 0;
    let output = "";

    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;

        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
}

function decodeSecret(secret) {
    if (typeof secret === "string") {
        return new TextEncoder().encode(secret);
    }
    return secret;
}

function hotp(secret, counter) {
    const key = decodeSecret(secret);
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    const high = Math.floor(counter / 0x100000000);
    const low = counter % 0x100000000;
    view.setUint32(0, high, false);
    view.setUint32(4, low, false);

    const hmac = new Bun.CryptoHasher("sha1", key);
    hmac.update(new Uint8Array(buffer));
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0x0f;
    const code =
        ((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff);

    return String(code % 1000000).padStart(6, "0");
}

/**
 * Generate a new TOTP secret.
 * @returns {string} Raw secret bytes as a string.
 */
function generateSecret() {
    return genSecret();
}

/**
 * Encode a secret for otpauth URI display.
 * @param {string} secret Raw secret.
 * @returns {string} Base32 secret without padding.
 */
function encodeSecretForUri(secret) {
    return encodeBase32(new TextEncoder().encode(secret)).replace(/=/g, "");
}

/**
 * Verify a TOTP token.
 * @param {string} token Token entered by the user.
 * @param {string} secret Stored secret.
 * @param {object} options Verification options.
 * @returns {boolean} True when valid.
 */
function verify(token, secret, options = {}) {
    const step = options.time || 30;
    const window = options.window ?? 1;
    const counter = Math.floor(Date.now() / 1000 / step);

    for (let offset = -window; offset <= window; offset++) {
        if (hotp(secret, counter + offset) === token) {
            return true;
        }
    }

    return false;
}

export { generateSecret, encodeSecretForUri, verify };
