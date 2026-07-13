// @ts-nocheck

import { expect, test } from "@playwright/test";
import { createHmac } from "node:crypto";
import { login, restoreSqliteSnapshot, serverUrl } from "../util-test";

function totp(uri, offset = 0) {
    const encoded = new URL(uri).searchParams.get("secret");
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const character of encoded) {
        bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
    }
    const secret = Buffer.from(bits.match(/.{8}/g).map((byte) => Number.parseInt(byte, 2)));
    const counter = Math.floor(Date.now() / 30_000) + offset;
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    buffer.writeUInt32BE(counter >>> 0, 4);
    const digest = createHmac("sha1", secret).update(buffer).digest();
    const index = digest[digest.length - 1] & 0x0f;
    return String((digest.readUInt32BE(index) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

async function expectBootstrapModalCleanup(page) {
    await expect(page.locator(".modal.show")).toHaveCount(0);
    await expect(page.locator(".modal-backdrop")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/modal-open/);
}

test.describe("Auth security UI", () => {
    test.beforeEach(async () => {
        await restoreSqliteSnapshot();
    });

    test("remember-me uses session storage and logout clears the browser session", async ({ page, context }) => {
        await page.goto("./dashboard");
        await page.getByPlaceholder("Username").fill("admin");
        await page.getByPlaceholder("Password", { exact: true }).fill("admin123");
        await page.getByLabel("Remember me").uncheck();
        await page.getByRole("button", { name: "Log in" }).click();
        await expect(page.getByText("Add New Monitor")).toBeVisible();

        const stored = await page.evaluate(() => ({
            local: localStorage.getItem("token"),
            session: sessionStorage.getItem("token"),
        }));
        expect(stored.local).toBeNull();
        expect(stored.session).toMatch(/^ey/);
        expect(await context.cookies()).toEqual([]);

        await page.getByText("A", { exact: true }).click();
        await page.getByRole("button", { name: "Log out", exact: true }).click();
        await expect(page.getByRole("form", { name: "Login Form" })).toBeVisible();
        expect(await page.evaluate(() => sessionStorage.getItem("token"))).toBeNull();
    });

    test("creates, uses, disables, enables, and deletes an API key", async ({ page }) => {
        await page.goto("./settings/api-keys");
        await login(page);

        await page.getByRole("button", { name: "Add API Key" }).click();
        let modal = page.locator(".modal.show");
        await modal.getByLabel("Name").fill("Playwright metrics key");
        await modal.getByLabel("Don't expire").check();
        await modal.getByRole("button", { name: "Generate" }).click();

        modal = page.getByRole("dialog").filter({ hasText: "Key Added" });
        await expect(modal.getByRole("heading", { name: "Key Added" })).toBeVisible();
        const key = await modal.locator("input[disabled]").inputValue();
        expect(key).toMatch(/^uk\d+_[a-f0-9]{40}$/);
        await modal.getByRole("button", { name: "Continue" }).click();
        await expect(modal).toBeHidden();
        await expectBootstrapModalCleanup(page);

        const item = page.locator(".item").filter({ hasText: "Playwright metrics key" });
        await expect(item).toContainText("Active");
        const metrics = await page.request.get(`${serverUrl}/metrics`, {
            headers: {
                authorization: `Basic ${Buffer.from(`:${key}`).toString("base64")}`,
            },
        });
        expect(metrics.status()).toBe(200);
        expect(await metrics.text()).toContain("# HELP monitor_status");

        await item.getByRole("button", { name: "Disable" }).click();
        await page.locator(".modal.show").getByRole("button", { name: "Yes" }).click();
        await expectBootstrapModalCleanup(page);
        await expect(item).toContainText("Inactive");
        await item.getByRole("button", { name: "Enable" }).click();
        await expect(item).toContainText("Active");

        await item.getByRole("button", { name: "Delete" }).click();
        await page.locator(".modal.show").getByRole("button", { name: "Yes" }).click();
        await expectBootstrapModalCleanup(page);
        await expect(page.getByText("No API Keys")).toBeVisible();
    });

    test("enables 2FA and requires a TOTP on the next UI login", async ({ page }) => {
        await page.goto("./settings/security");
        await login(page);

        await page.getByRole("button", { name: "2FA Settings" }).click();
        let modal = page.getByRole("dialog").filter({ hasText: "Set Up 2FA" });
        await modal.locator('input[autocomplete="current-password"]').fill("admin123");
        await modal.getByRole("button", { name: "Enable 2FA" }).click();
        await modal.getByRole("button", { name: "Show URI" }).click();
        const uri = await modal.locator("p").filter({ hasText: "otpauth://" }).textContent();
        await modal.locator('input[autocomplete="one-time-code"]').fill(totp(uri));
        await modal.getByRole("button", { name: "Verify Token" }).click();
        await expect(modal.getByText(/Token is valid/)).toBeVisible();
        await modal.getByRole("button", { name: "Save" }).click();
        await page.locator(".modal.show").getByRole("button", { name: "Yes" }).click();
        await expect(modal).toBeHidden();
        await expectBootstrapModalCleanup(page);
        await expect(page.getByText("2FA Enabled")).toBeVisible();

        await page.getByText("A", { exact: true }).click();
        await page.getByRole("button", { name: "Log out", exact: true }).click();
        await page.getByPlaceholder("Username").fill("admin");
        await page.getByPlaceholder("Password", { exact: true }).fill("admin123");
        await page.getByRole("button", { name: "Log in" }).click();
        await expect(page.getByLabel("Token")).toBeVisible();
        await page.getByLabel("Token").fill(totp(uri, 1));
        await page.getByRole("button", { name: "Log in" }).click();
        await expect(page.getByText("Add New Monitor")).toBeVisible();

        await page.goto("./settings/security");
        await page.getByRole("button", { name: "2FA Settings" }).click();
        modal = page.getByRole("dialog").filter({ hasText: "Set Up 2FA" });
        await modal.locator('input[autocomplete="current-password"]').fill("admin123");
        await modal.getByRole("button", { name: "Disable 2FA" }).click();
        await page.locator(".modal.show").getByRole("button", { name: "Yes" }).click();
        await expect(modal).toBeHidden();
        await expectBootstrapModalCleanup(page);
        await expect(page.getByText("2FA Disabled")).toBeVisible();
    });
});
