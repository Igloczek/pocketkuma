// @ts-nocheck

/**
 * Hash a password
 * @param {string} password Password to hash
 * @returns {Promise<string>} Hash
 */
import crypto from "node:crypto";

export async function generate(password) {
    return await Bun.password.hash(password, {
        algorithm: "argon2id",
    });
}

/**
 * Verify a password against a hash
 * @param {string} password Password to verify
 * @param {string} hash Hash to verify against
 * @returns {boolean} Does the password match the hash?
 */
export async function verify(password, hash) {
    if (isSHA1(hash)) {
        return verifyLegacySHA1(password, hash);
    }

    try {
        return await Bun.password.verify(password, hash);
    } catch (e) {
        return false;
    }
}

function verifyLegacySHA1(password, hash) {
    const parts = makeLegacySHA1BackwardCompatible(hash).split("$");
    if (parts.length !== 4) {
        return false;
    }

    const [algorithm, salt, iterations, digest] = parts;
    let candidate = password;
    for (let i = 0; i < Number(iterations); i++) {
        candidate = crypto.createHmac(algorithm, salt).update(candidate).digest("hex");
    }
    if (candidate.length !== digest.length) {
        return false;
    }

    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(digest));
}

function makeLegacySHA1BackwardCompatible(hash) {
    const parts = hash.split("$");
    if (parts.length === 3) {
        parts.splice(2, 0, "1");
        return parts.join("$");
    }
    return hash;
}

/**
 * Is the hash a SHA1 hash
 * @param {string} hash Hash to check
 * @returns {boolean} Is SHA1 hash?
 */
function isSHA1(hash) {
    return typeof hash === "string" && hash.startsWith("sha1");
}

/**
 * Does the hash need to be rehashed?
 * @param {string} hash Hash to check
 * @returns {boolean} Needs to be rehashed?
 */
export function needRehash(hash) {
    return !isBunPasswordHash(hash);
}

function isBunPasswordHash(hash) {
    return typeof hash === "string" && hash.startsWith("$argon2id$");
}

export default { generate, verify, needRehash };
