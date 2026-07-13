// @ts-nocheck

import { describe, test, expect, spyOn } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import StatusPage from "@/server/model/status_page";
import { BunSQLiteRedbean, R } from "@/server/bun-sqlite-store";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { STATUS_PAGE_ALL_UP, STATUS_PAGE_ALL_DOWN, STATUS_PAGE_PARTIAL_DOWN, STATUS_PAGE_MAINTENANCE } from "@/util";

dayjs.extend(utc);

describe("StatusPage", () => {
    test("rolls back when the first domain-mapping statement fails", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pocketkuma-status-page-transaction-"));
        const store = new BunSQLiteRedbean();
        const originalBegin = R.begin;
        await store.connect({
            sqlitePath: path.join(dir, "kuma.db"),
            templatePath: path.join(process.cwd(), "src/db/kuma.db"),
            testMode: true,
        });
        await store.exec(
            "INSERT INTO status_page (id, slug, title, icon, theme) VALUES (1, 'test', 'Test', '', 'auto')"
        );
        await store.exec("INSERT INTO status_page_cname (status_page_id, domain) VALUES (1, 'old.example.com')");
        await store.exec(`
            CREATE TRIGGER reject_first_domain_delete
            BEFORE DELETE ON status_page_cname
            BEGIN
                SELECT RAISE(ABORT, 'forced first statement failure');
            END
        `);
        let transaction;
        R.begin = async () => (transaction = await store.begin());

        try {
            const page = Object.assign(new StatusPage(), { id: 1 });
            await expect(page.updateDomainNameList(["status.example.com"])).rejects.toThrow(
                "forced first statement failure"
            );
            await expect(
                Promise.race([
                    store.getCell("SELECT 1"),
                    Bun.sleep(100).then(() => {
                        throw new Error("subsequent operation stayed blocked");
                    }),
                ])
            ).resolves.toBe(1);
        } finally {
            R.begin = originalBegin;
            await transaction?.rollback();
            await store.close();
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    describe("getStatusDescription()", () => {
        test("returns 'No Services' when status is -1", () => {
            const description = StatusPage.getStatusDescription(-1);
            expect(description).toBe("No Services");
        });

        test("returns 'All Systems Operational' when all services are up", () => {
            const description = StatusPage.getStatusDescription(STATUS_PAGE_ALL_UP);
            expect(description).toBe("All Systems Operational");
        });

        test("returns 'Partially Degraded Service' when some services are down", () => {
            const description = StatusPage.getStatusDescription(STATUS_PAGE_PARTIAL_DOWN);
            expect(description).toBe("Partially Degraded Service");
        });

        test("returns 'Degraded Service' when all services are down", () => {
            const description = StatusPage.getStatusDescription(STATUS_PAGE_ALL_DOWN);
            expect(description).toBe("Degraded Service");
        });

        test("returns 'Under maintenance' when status page is in maintenance", () => {
            const description = StatusPage.getStatusDescription(STATUS_PAGE_MAINTENANCE);
            expect(description).toBe("Under maintenance");
        });

        test("returns '?' for unknown status values", () => {
            const description = StatusPage.getStatusDescription(999);
            expect(description).toBe("?");
        });
    });

    describe("renderRSS()", () => {
        const MOCK_FEED_URL = "http://localhost:3001/status/test";

        test("pubDate uses UTC timezone for heartbeat.time without timezone info", async () => {
            const mockStatusPage = {
                title: "Test Status Page",
            };

            const mockIncidents = [
                {
                    title: "Test Monitor",
                    content: "Test content",
                    id: 1,
                    createdDate: "2026-05-21 15:07:35.600",
                },
            ];

            const mockHeartbeats = [
                {
                    name: "Test Monitor",
                    monitorID: 1,
                    time: "2026-01-24 13:16:25.400",
                },
            ];

            const getRSSPageDataSpy = spyOn(StatusPage, "getRSSPageData").mockImplementation(async () => ({
                incidents: mockIncidents,
                heartbeats: mockHeartbeats,
                statusDescription: "All Systems Operational",
            }));

            try {
                const rss = await StatusPage.renderRSS(mockStatusPage, MOCK_FEED_URL);

                expect(rss.includes("<pubDate>Sat, 24 Jan 2026 13:16:25 GMT</pubDate>")).toBeTruthy();
            } finally {
                getRSSPageDataSpy.mockRestore();
            }
        });
    });
});
