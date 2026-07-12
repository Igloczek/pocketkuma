// @ts-nocheck
import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot, serverUrl } from "../util-test";

test.describe("Friendly Name Tests", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("hostname", async ({ page }, testInfo) => {
        // Test a local port monitor with hostname
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);

        await page.getByTestId("monitor-type-select").selectOption("port");
        await page.getByTestId("hostname-input").fill("localhost");
        await page.locator("#port").fill(new URL(serverUrl).port);
        await screenshot(testInfo, page);

        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        await expect(page.getByTestId("monitor-list")).toContainText("localhost");
        await screenshot(testInfo, page);
    });

    test("URL hostname", async ({ page }, testInfo) => {
        // Test HTTP monitor with URL
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);

        await page.getByTestId("monitor-type-select").selectOption("http");
        await page.getByTestId("url-input").fill(serverUrl);
        await screenshot(testInfo, page);

        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        await expect(page.getByTestId("monitor-list")).toContainText("localhost");
        await screenshot(testInfo, page);
    });

    test("custom friendly name", async ({ page }, testInfo) => {
        // Test custom friendly name for HTTP monitor
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);

        await page.getByTestId("monitor-type-select").selectOption("http");
        await page.getByTestId("url-input").fill(serverUrl);

        // Check if the friendly name placeholder is set to the hostname
        const friendlyNameInput = page.getByTestId("friendly-name-input");
        await expect(friendlyNameInput).toHaveAttribute("placeholder", "localhost");
        await screenshot(testInfo, page);

        const customName = "Example Monitor";
        await friendlyNameInput.fill(customName);
        await screenshot(testInfo, page);

        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        await expect(page.getByTestId("monitor-list")).toContainText(customName);
        await screenshot(testInfo, page);
    });

    test("default friendly name", async ({ page }, testInfo) => {
        // Test default friendly name when no custom name is provided
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);

        await page.getByTestId("monitor-type-select").selectOption("group");
        await screenshot(testInfo, page);

        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        await expect(page.getByTestId("monitor-list")).toContainText("New Monitor");
        await screenshot(testInfo, page);
    });
});
