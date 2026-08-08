import crypto from "node:crypto";

export const SHAKE256_LENGTH = 16;

export function shake256(data, length) {
    if (!data) {
        return "";
    }

    return crypto.createHash("shake256", { outputLength: length }).update(data).digest("hex");
}
