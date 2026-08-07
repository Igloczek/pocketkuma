// @ts-nocheck

import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import {
    median,
    parseFootprintBytes,
    parseReadyLine,
    parseRssKb,
    runTrial,
    variants,
} from "@/../scripts/benchmark/startup-memory";

describe("startup memory benchmark harness", () => {
    test("application variants use process-group cleanup", () => {
        for (const name of ["source-backend", "compiled-binary"]) {
            expect(variants.find((variant) => variant.name === name)?.processGroup).toBe(true);
        }
    });

    test("parses readiness and external memory samples", () => {
        expect(parseReadyLine('{"event":"ready","synthetic":{}}')).toEqual({ event: "ready", synthetic: {} });
        expect(parseReadyLine("not json")).toBeNull();
        expect(parseRssKb(" 123456\n")).toBe(123456);
        expect(parseRssKb("RSS unavailable")).toBeNull();
        expect(parseFootprintBytes("Physical footprint: 1.5M")).toBe(1.5 * 1024 * 1024);
        expect(median([3, 1, 2])).toBe(2);
        expect(median([4, 1, 3, 2])).toBe(2.5);
        expect(() => median([])).toThrow("without values");
    });

    test("runTrial cleans up the child process and fresh data directory", async () => {
        const result = await runTrial({
            name: "lifecycle",
            command: () => [process.execPath, "-e", 'console.log("READY"); await new Promise(() => {});'],
            readiness: () => ({ kind: "stdout", marker: "READY" }),
            warmupMs: 1,
            timeoutMs: 2_000,
            measureMetrics: false,
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
                measureMetrics: false,
            })
        ).rejects.toThrow("Readiness timed out");
    });

    test(
        "runTrial force-kills a SIGTERM-ignoring process and its child",
        async () => {
            let childPid;
            const childScript = 'process.on("SIGTERM", () => {}); await new Promise(() => {});';
            const parentScript = `
            const child = Bun.spawn([${JSON.stringify(process.execPath)}, "-e", ${JSON.stringify(childScript)}], {
                stdio: ["ignore", "ignore", "ignore"],
            });
            console.log("READY CHILD=" + child.pid);
            process.on("SIGTERM", () => {});
            await new Promise(() => {});
        `;

            const result = await runTrial({
                name: "sigterm-ignored",
                command: () => [process.execPath, "-e", parentScript],
                readiness: () => ({ kind: "stdout", marker: "READY" }),
                warmupMs: 1,
                timeoutMs: 2_000,
                processGroup: true,
                measureMetrics: false,
            });

            childPid = Number(result.stdout.match(/CHILD=(\d+)/)?.[1]);
            expect(result.forcedKill).toBe(true);
            expect(Number.isInteger(childPid)).toBe(true);
            expect(() => process.kill(childPid, 0)).toThrow();
        },
        { timeout: 15_000 }
    );
});
