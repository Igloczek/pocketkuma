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

    test("resets all-status-pages selection when the reused edit route becomes add", async ({ page }) => {
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
        await page.locator("#name").fill("All pages route reuse");
        await page.locator("#strategy").selectOption("manual");
        await page.locator("#show-on-all-pages").check();
        await page.locator("#monitor-submit-btn").click();
        await page.getByRole("button", { name: "Yes" }).click();
        await page.waitForURL("/maintenance");

        const row = page.locator(".item").filter({ hasText: "All pages route reuse" });
        await row.getByRole("link", { name: "Edit this maintenance schedule" }).click();
        await expect(page.locator("#show-on-all-pages")).toBeChecked();
        await page.evaluate(() => window.app._vnode.component.proxy.$router.push("/add-maintenance"));
        await page.waitForURL("/add-maintenance");
        await expect(page.locator("#show-on-all-pages")).not.toBeChecked();
        await page.locator("#show-on-all-pages").check();
        await page.evaluate(() => {
            const findView = (vnode) => {
                if (!vnode) {
                    return null;
                }
                if (Array.isArray(vnode)) {
                    for (const child of vnode) {
                        const match = findView(child);
                        if (match) {
                            return match;
                        }
                    }
                    return null;
                }
                if (typeof vnode.component?.proxy?.init === "function" && "showOnAllPages" in vnode.component.proxy) {
                    return vnode.component.proxy;
                }
                return findView(vnode.component?.subTree) || findView(vnode.children);
            };
            findView(window.app._vnode).init();
        });
        await expect(page.locator("#show-on-all-pages")).not.toBeChecked();
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    });

    test("ignores a delayed edit response after the reused route becomes add", async ({ page }) => {
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
        await page.locator("#name").fill("Stale submit");
        await page.locator("#strategy").selectOption("manual");
        await page.locator("#show-on-all-pages").check();
        await page.locator("#monitor-submit-btn").click();
        await page.getByRole("button", { name: "Yes" }).click();
        await page.waitForURL("/maintenance");

        const row = page.locator(".item").filter({ hasText: "Stale submit" });
        await row.getByRole("link", { name: "Edit this maintenance schedule" }).click();
        await expect(page.locator("#show-on-all-pages")).toBeChecked();
        await page.evaluate(() => {
            const socket = window.app._vnode.component.proxy.appStore.getSocket();
            const emit = socket.emit.bind(socket);
            socket.emit = (event, ...args) => {
                if (event === "editMaintenance") {
                    window.__maintenanceSubmitCallback = args.at(-1);
                    return socket;
                }
                return emit(event, ...args);
            };
        });
        await page.locator("#monitor-submit-btn").click();
        await page.getByRole("button", { name: "Yes" }).click();
        await expect.poll(() => page.evaluate(() => typeof window.__maintenanceSubmitCallback)).toBe("function");
        await page.evaluate(() => window.app._vnode.component.proxy.$router.push("/add-maintenance"));
        await page.waitForURL("/add-maintenance");
        await expect(page.locator("#monitor-submit-btn")).toBeEnabled();
        await expect(page.locator("#show-on-all-pages")).not.toBeChecked();
        await page.evaluate(() =>
            window.__maintenanceSubmitCallback({
                ok: true,
                msg: "Saved.",
                msgi18n: true,
                maintenanceID: 1,
            })
        );
        await page.waitForTimeout(250);
        await expect(page).toHaveURL(/\/add-maintenance$/);
        await expect(page.locator("#monitor-submit-btn")).toBeEnabled();
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    });

    test("saves, reloads, edits, and deletes every supported strategy", async ({ page }) => {
        test.setTimeout(120_000);
        await page.goto("./add-maintenance");
        await login(page);

        const pageErrors = [];
        const consoleErrors = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("console", (message) => {
            if (message.type() === "error") {
                consoleErrors.push(message.text());
            }
        });

        const schedules = [
            ["manual", async () => {}],
            ["single", async () => {}],
            ["cron", async () => {}],
            ["recurring-interval", async () => {}],
            ["recurring-weekday", async () => page.locator("#weekday1").check()],
            ["recurring-day-of-month", async () => page.locator("#day31").check()],
        ];

        for (const [index, [strategy, configure]] of schedules.entries()) {
            const title = `Lifecycle ${strategy}`;
            const updatedTitle = `${title} edited`;
            await page.goto("./add-maintenance");
            await page.locator("#name").fill(title);
            await page.locator("#strategy").selectOption(strategy);
            await configure();
            await page.locator("#show-on-all-pages").check();
            await page.locator("#monitor-submit-btn").click();
            if (index === 0) {
                await page.getByRole("button", { name: "No" }).click();
                await expect(page.locator("#name")).toHaveValue(title);
                await page.locator("#monitor-submit-btn").click();
            }
            await page.getByRole("button", { name: "Yes" }).click();
            await page.waitForURL("/maintenance");
            await page.reload();
            await expect(page.getByText(title, { exact: true })).toBeVisible();

            const row = page.locator(".item").filter({ hasText: title });
            await row.getByRole("link", { name: "Edit this maintenance schedule" }).click();
            await expect(page.locator("#name")).toHaveValue(title);
            await expect(page.locator("#strategy")).toHaveValue(strategy);
            await page.locator("#name").fill(updatedTitle);
            await page.locator("#monitor-submit-btn").click();
            await page.getByRole("button", { name: "Yes" }).click();
            await page.waitForURL("/maintenance");
            await expect(page.getByText(updatedTitle, { exact: true })).toBeVisible();
            let updatedRow = page.locator(".item").filter({ hasText: updatedTitle });
            await updatedRow.getByRole("link", { name: "Edit this maintenance schedule" }).click();
            await expect(page.locator("#name")).toHaveValue(updatedTitle);
            await expect(page.locator("#strategy")).toHaveValue(strategy);
            await page.goto("./maintenance");
            updatedRow = page.locator(".item").filter({ hasText: updatedTitle });
            await updatedRow.getByRole("button", { name: "Delete this maintenance schedule" }).click();
            await page.getByRole("button", { name: "Yes" }).click();
            await expect(page.getByText(updatedTitle, { exact: true })).toHaveCount(0);
        }

        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    });
});
