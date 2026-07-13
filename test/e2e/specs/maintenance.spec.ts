// @ts-nocheck

import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot } from "../util-test";

test.describe("Maintenance", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("creates, pauses, resumes, and deletes a manual maintenance window", async ({ page }) => {
        const monitorName = "Maintenance target";

        await page.goto("./add");
        await login(page);
        await page.getByTestId("monitor-type-select").selectOption("manual");
        await page.getByTestId("friendly-name-input").fill(monitorName);
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        await page.goto("./add-maintenance");
        await page.locator("#name").fill("Manual maintenance");
        await page.locator("#strategy").selectOption("manual");
        await page.locator("#affected_monitors").locator("..").click();
        await page.getByRole("option", { name: monitorName }).click();
        await page.locator("#monitor-submit-btn").click();
        await page.waitForURL("/maintenance");

        await expect(page.getByText("Manual maintenance", { exact: true })).toBeVisible();
        await expect(page.getByText("Manual", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Pause this maintenance schedule" }).click();
        await page.getByRole("button", { name: "Yes" }).click();
        await expect(page.getByText("Inactive", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Resume this maintenance schedule" }).click();
        await expect(page.getByText("Under Maintenance", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Delete this maintenance schedule" }).click();
        await page.getByRole("button", { name: "Yes" }).click();
        await expect(page.getByText("No Maintenance", { exact: true })).toBeVisible();
    });

    test("renders the dynamic inputs for every supported strategy without page errors", async ({ page }) => {
        const pageErrors = [];
        const consoleErrors = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("console", (message) => {
            if (message.type() === "error") {
                consoleErrors.push(message.text());
            }
        });

        await page.goto("./add-maintenance");
        await login(page);
        const strategy = page.locator("#strategy");

        await strategy.selectOption("manual");
        await expect(page.locator("#timezone")).toHaveCount(0);

        await strategy.selectOption("single");
        await expect(page.locator("input[type='datetime-local']")).toHaveCount(2);
        await expect(page.locator("#timezone")).toBeVisible();

        await strategy.selectOption("cron");
        await expect(page.locator("#cron")).toBeVisible();
        await expect(page.locator("#duration")).toBeVisible();

        await strategy.selectOption("recurring-interval");
        await expect(page.locator("#interval-day")).toBeVisible();
        await expect(page.getByText("Maintenance Time Window of a Day")).toBeVisible();

        await strategy.selectOption("recurring-weekday");
        await expect(page.locator("#weekday1")).toBeVisible();
        await page.locator("#weekday1").check();

        await strategy.selectOption("recurring-day-of-month");
        await expect(page.locator("#day31")).toBeVisible();
        await expect(page.locator("#lastDay1")).toBeVisible();
        await page.locator("#day31").check();
        await page.locator("#lastDay1").check();

        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    });
});
