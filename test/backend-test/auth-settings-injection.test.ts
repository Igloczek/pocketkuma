import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import TwoFA from "@/server/2fa";
import { login } from "@/server/auth";
import { BunSQLiteRedbean } from "@/server/sqlite-core";
import User from "@/server/model/user";
import passwordHash from "@/server/password-hash";
import { initJWTSecret } from "@/server/server-auth-helpers";
import { Settings } from "@/server/settings";

const directories = [];

async function createStore() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pocketkuma-auth-settings-"));
    directories.push(directory);
    const store = new BunSQLiteRedbean();
    await store.connect({
        sqlitePath: path.join(directory, "kuma.db"),
        templatePath: path.join(process.cwd(), "src/db/kuma.db"),
        testMode: true,
    });
    return store;
}

afterEach(async () => {
    for (const directory of directories.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

describe("auth and settings storage injection", () => {
    test("keeps auth, persistent sessions, 2FA, and settings isolated per store", async () => {
        const first = await createStore();
        const second = await createStore();
        const firstSettings = new Settings(first);
        const secondSettings = new Settings(second);
        const password = "correct horse battery staple";
        const hash = await passwordHash.generate(password);

        try {
            await first.exec("INSERT INTO user (id, username, password, active, twofa_status) VALUES (?, ?, ?, ?, ?)", [
                1,
                "admin",
                hash,
                1,
                1,
            ]);
            await second.exec(
                "INSERT INTO user (id, username, password, active, twofa_status) VALUES (?, ?, ?, ?, ?)",
                [1, "admin", hash, 1, 1]
            );

            await firstSettings.set("entryPage", "first", "general");
            expect(await secondSettings.get("entryPage")).toBeNull();
            expect((await login(first, "admin", password))?.id).toBe(1);
            expect(await User.hasSession(second, "missing", 1)).toBe(false);

            const session = await User.createSession(first, { id: 1, username: "admin", password: hash }, "jwt-secret");
            expect(await User.hasSession(first, session.id, 1)).toBe(true);
            expect(await User.hasSession(second, session.id, 1)).toBe(false);

            await TwoFA.disable2FA(first, 1);
            expect(await first.getCell("SELECT twofa_status FROM user WHERE id = ?", [1])).toBe(0);
            expect(await second.getCell("SELECT twofa_status FROM user WHERE id = ?", [1])).toBe(1);

            await initJWTSecret(first);
            expect(await second.getCell("SELECT value FROM setting WHERE `key` = ?", ["jwtSecret"])).toBeNull();
        } finally {
            firstSettings.stopCacheCleaner();
            secondSettings.stopCacheCleaner();
            await first.close();
            await second.close();
        }
    });
});
