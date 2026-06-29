// @ts-nocheck

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const ALPHABET_LENGTH = ALPHABET.length;
const MAX_BYTE = 256 - (256 % ALPHABET_LENGTH);

/**
 * Generate a random alphanumeric ID without modulo bias.
 * @param {number} length ID length.
 * @returns {string} Random ID.
 */
function randomId(length = 21) {
    let id = "";

    while (id.length < length) {
        const bytes = crypto.getRandomValues(new Uint8Array(length));
        for (let i = 0; i < bytes.length && id.length < length; i++) {
            if (bytes[i] < MAX_BYTE) {
                id += ALPHABET[bytes[i] % ALPHABET_LENGTH];
            }
        }
    }

    return id;
}

export { randomId };
