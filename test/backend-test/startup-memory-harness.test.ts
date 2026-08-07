// @ts-nocheck

import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import {
    median,
    parseFootprintBytes,
    parseReadyLine,
    parseRssKb,
    runTrial,
} from "@/../scripts/benchmark/startup-memory";

describe("startup memory benchmark harness", () => {
    test("parses readiness and external memory samples", () => {
        expect(parseReadyLine('{"event":"ready","synthetic":{}}')).toEqual({ event: "ready", synthetic: {} });
        expect(parseReadyLine("not json")).toBeNull();
        expect(parseRssKb(" 123456\n")).toBe(123456);
        expect(parseFootprintBytes("Physical footprint: 1.5M")).toBe(1.5 * 1024 * 1024);
        expect(median([3, 1, 2])).toBe(2);
        expect(median([4, 1, 3, 2])).toBe(2.5);
    });

    test("runTrial cleans up the child process and fresh data directory", async () => {
        const result = await runTrial({
            name: "lifecycle",
            command: () => [process.execPath, "-e", 'console.log("READY"); await new Promise(() => {});'],
            readiness: () => ({ kind: "stdout", marker: "READY" }),
            warmupMs: 1,
            timeoutMs: 2_000,
        });

        expect(result.readinessMs).toBeGreaterThanOrEqual(0);
        expect(fs.existsSync(result.dataDir)).toBe(false);
    });

    test("runTrial reports a process that exits before readiness", async () => {
        await expect(
            runTrial({
                name: "start-error",
                command: () => [process.execPath, "-e", 'console.error("startup failed"); process.exit(7);'],
                readiness: () => ({ kind: "stdout", marker: "READY" }),
                timeoutMs: 2_000,
            })
        ).rejects.toThrow("Process exited before readiness");
    });

    test("runTrial reports a readiness timeout and still cleans up", async () => {
        await expect(
            runTrial({
                name: "timeout",
                command: () => [process.execPath, "-e", "await new Promise(() => {});"],
                readiness: () => ({ kind: "stdout", marker: "READY" }),
                timeoutMs: 50,
            })
        ).rejects.toThrow("Readiness timed out");
    });
});
