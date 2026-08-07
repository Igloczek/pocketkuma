#!/usr/bin/env bun
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const decoder = new TextDecoder();

function option(name, fallback = "") {
    const value = process.argv.find((arg) => arg.startsWith(`--${name}=`));
    return value ? value.slice(name.length + 3) : fallback;
}

function commandOutput(command) {
    const result = Bun.spawnSync(command);
    return result.exitCode === 0 ? decoder.decode(result.stdout) : "";
}

function metrics(pid) {
    const rssKb = Number.parseInt(commandOutput(["ps", "-o", "rss=", "-p", String(pid)]).trim(), 10);
    const footprint = commandOutput(["footprint", "-p", String(pid), "-f", "bytes"]);
    const footprintBytes = Number(
        footprint.match(/(?:physical\s+)?footprint\s*:\s*([\d,.]+)\s*([KMGT]?)/i)?.[1]?.replaceAll(",", "")
    );
    return {
        rssKb: Number.isFinite(rssKb) ? rssKb : null,
        footprintBytes: Number.isFinite(footprintBytes) ? footprintBytes : null,
    };
}

async function waitForReady(stream) {
    const reader = stream.getReader();
    let output = "";
    try {
        while (!output.includes("ready\n")) {
            const { done, value } = await reader.read();
            if (done) {
                throw new Error(`Store import exited before readiness: ${output}`);
            }
            output += decoder.decode(value);
        }
    } finally {
        reader.releaseLock();
    }
}

async function measure(name, modulePath, gitSha, trial) {
    const startedAt = performance.now();
    const processHandle = Bun.spawn(
        [
            process.execPath,
            "-e",
            `await import(${JSON.stringify(modulePath)}); process.stdout.write("ready\\n"); setInterval(() => {}, 1_000);`,
        ],
        { stdout: "pipe", stderr: "pipe" }
    );
    try {
        await waitForReady(processHandle.stdout);
        return {
            name,
            gitSha,
            trial,
            importMs: Math.round(performance.now() - startedAt),
            ...metrics(processHandle.pid),
        };
    } finally {
        processHandle.kill();
        await processHandle.exited;
    }
}

const modules = process.argv
    .filter((arg) => arg.startsWith("--module="))
    .map((arg) => arg.slice("--module=".length).split(",", 3))
    .map(([name, modulePath, gitSha]) => ({ name, modulePath: path.resolve(modulePath), gitSha }));
const trials = Number(option("trials", "5"));
const outfile = path.resolve(option("outfile", "docs/perf/sqlite-store-import.json"));

if (
    modules.length < 1 ||
    modules.some(({ name, modulePath, gitSha }) => !name || !gitSha || !fs.existsSync(modulePath)) ||
    trials < 1
) {
    throw new Error(
        "Use --module=<name>,<absolute-or-relative-module-path>,<git-sha> at least once and --trials=<positive integer>."
    );
}

const runs = [];
for (let trial = 1; trial <= trials; trial++) {
    for (const { name, modulePath, gitSha } of modules) {
        console.error(`${name}: trial ${trial}/${trials}`);
        runs.push(await measure(name, modulePath, gitSha, trial));
    }
}

const report = {
    measuredAt: new Date().toISOString(),
    bunVersion: Bun.version,
    os: `${os.platform()} ${os.release()}`,
    arch: process.arch,
    modules,
    runs,
};
fs.writeFileSync(outfile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
