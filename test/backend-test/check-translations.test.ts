import { describe, test, expect } from "bun:test";
import fs from "node:fs/promises";

const EN_PLACEHOLDER_CONTRACT_SHA256 = "0c35ecd8cd6425bfb09c65d4f95a8cac9cb343d6f6f5d98fdc3b2f302c396798";

function extractParams(value) {
    if (typeof value !== "string") {
        return new Set();
    }

    return new Set(Array.from(value.matchAll(/\{([^}]+)\}/g), (match) => match[1]));
}

describe("English translation data contract", () => {
    test("en.json translations preserve placeholder parameters", async () => {
        const enTranslations = JSON.parse(await fs.readFile("src/lang/en.json", "utf-8"));
        const contract = Object.entries(enTranslations)
            .map(([key, value]) => [key, [...extractParams(value)].sort()])
            .filter(([, params]) => params.length > 0)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        const digest = new Bun.CryptoHasher("sha256").update(JSON.stringify(contract)).digest("hex");

        expect(digest).toBe(EN_PLACEHOLDER_CONTRACT_SHA256);
    });
});
