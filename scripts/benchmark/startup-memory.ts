#!/usr/bin/env bun
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const decoder = new TextDecoder();
const projectRoot = path.resolve(import.meta.dirname, "../..");
const defaultTimeoutMs = 30_000;
const defaultWarmupMs = 1_000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function median(values) {
    if (!values.length) {
        throw new Error("Cannot calculate a median without values.");
    }

    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function parseReadyLine(line) {
    try {
        const value = JSON.parse(line);
        return value?.event === "ready" ? value : null;
    } catch {
        return null;
    }
}

function parseNumber(text) {
    const match = text.replaceAll(",", "").match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
}

function parseRssKb(text) {
    return parseNumber(text.trim());
}

function parseFootprintBytes(text) {
    const match = text.match(/(?:physical\s+)?footprint\s*:\s*([\d,.]+)\s*([KMGT]?)/i);
    if (!match) {
        return null;
    }

    const value = Number(match[1].replaceAll(",", ""));
    const multiplier = { "": 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 }[match[2].toUpperCase()];
    return Number.isFinite(value) && multiplier ? Math.round(value * multiplier) : null;
}

function commandOutput(command) {
    try {
        const result = Bun.spawnSync(command);
        return result.exitCode === 0 ? decoder.decode(result.stdout) : "";
    } catch {
        return "";
    }
}

function readExternalMetrics(pid) {
    const rssKb = parseRssKb(commandOutput(["ps", "-o", "rss=", "-p", String(pid)]));
    const footprintBytes =
        process.platform === "darwin"
            ? parseFootprintBytes(commandOutput(["footprint", "-p", String(pid), "-f", "bytes"]))
            : null;
    return { rssKb, footprintBytes };
}

async function readStream(stream, onChunk) {
    const reader = stream.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                return;
            }
            onChunk(decoder.decode(value));
        }
    } finally {
        reader.releaseLock();
    }
}

async function stopProcess(processHandle, exited) {
    if (!exited.value) {
        processHandle.kill();
        await Promise.race([processHandle.exited, sleep(2_000)]);
    }
    if (!exited.value) {
        processHandle.kill(9);
        await processHandle.exited;
    }
}

async function waitForReady({ processHandle, exited, stdout, readiness, timeoutMs }) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (exited.value) {
            throw new Error(`Process exited before readiness (code=${processHandle.exitCode}).\n${stdout.value}`);
        }

        if (readiness.kind === "stdout" && stdout.value.includes(readiness.marker)) {
            return;
        }

        if (readiness.kind === "http") {
            try {
                const response = await fetch(readiness.url);
                if (response.status < 500) {
                    return;
                }
            } catch {
                // The process is still starting.
            }
        }

        await sleep(50);
    }

    throw new Error(`Readiness timed out after ${timeoutMs}ms.`);
}

async function findFreePort() {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    return port;
}

async function runTrial({
    name,
    command,
    readiness,
    requiresPort = false,
    timeoutMs = defaultTimeoutMs,
    warmupMs = defaultWarmupMs,
}) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pocketkuma-startup-"));
    let port = 0;
    const stdout = { value: "" };
    const stderr = { value: "" };
    const exited = { value: false };
    let processHandle;
    let stdoutReader;
    let stderrReader;

    try {
        if (requiresPort) {
            port = await findFreePort();
        }
        processHandle = Bun.spawn(command({ port, dataDir }), {
            cwd: projectRoot,
            env: { ...process.env, BENCHMARK_PORT: String(port), BENCHMARK_DATA_DIR: dataDir },
            stdout: "pipe",
            stderr: "pipe",
        });
        processHandle.exited.then(() => {
            exited.value = true;
        });
        stdoutReader = readStream(processHandle.stdout, (chunk) => {
            stdout.value += chunk;
        });
        stderrReader = readStream(processHandle.stderr, (chunk) => {
            stderr.value += chunk;
        });

        const startedAt = performance.now();
        await waitForReady({ processHandle, exited, stdout, readiness: readiness({ port }), timeoutMs });
        const readinessMs = Math.round(performance.now() - startedAt);
        await sleep(warmupMs);
        const metrics = readExternalMetrics(processHandle.pid);
        const readyLine = stdout.value
            .split("\n")
            .map((line) => parseReadyLine(line))
            .find((value) => value);

        return {
            name,
            port,
            readinessMs,
            ...metrics,
            synthetic: readyLine?.synthetic || null,
            stdout: stdout.value,
            stderr: stderr.value,
            dataDir,
        };
    } finally {
        if (processHandle) {
            await stopProcess(processHandle, exited);
            await Promise.all([stdoutReader, stderrReader]);
        }
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
}

const variants = [
    {
        name: "minimal-bun",
        synthetic: true,
        command: () => [process.execPath, "scripts/benchmark/probes/minimal-bun.ts"],
        readiness: () => ({ kind: "stdout", marker: '"event":"ready"' }),
    },
    {
        name: "minimal-bun-serve",
        synthetic: true,
        requiresPort: true,
        command: () => [process.execPath, "scripts/benchmark/probes/minimal-bun-serve.ts"],
        readiness: ({ port }) => ({ kind: "http", url: `http://127.0.0.1:${port}/` }),
    },
    {
        name: "source-backend",
        synthetic: false,
        requiresPort: true,
        command: ({ port, dataDir }) => [
            process.execPath,
            "src/server/server.ts",
            "--host=127.0.0.1",
            `--port=${port}`,
            `--data-dir=${dataDir}`,
        ],
        readiness: ({ port }) => ({ kind: "http", url: `http://127.0.0.1:${port}/` }),
    },
    {
        name: "compiled-binary",
        synthetic: false,
        requiresPort: true,
        command: ({ port, dataDir }) => [
            path.join(projectRoot, "pocketkuma"),
            "--host=127.0.0.1",
            `--port=${port}`,
            `--data-dir=${dataDir}`,
        ],
        readiness: ({ port }) => ({ kind: "http", url: `http://127.0.0.1:${port}/` }),
    },
];

async function runBenchmark({
    trials = 3,
    timeoutMs = defaultTimeoutMs,
    warmupMs = defaultWarmupMs,
    variantName,
} = {}) {
    if (trials < 3) {
        throw new Error("Startup benchmark requires at least 3 trials per variant.");
    }

    const selectedVariants = variantName ? variants.filter((variant) => variant.name === variantName) : variants;
    if (!selectedVariants.length) {
        throw new Error(`Unknown benchmark variant: ${variantName}`);
    }

    for (const variant of selectedVariants) {
        if (variant.name === "compiled-binary" && !fs.existsSync(path.join(projectRoot, "pocketkuma"))) {
            throw new Error("Compiled benchmark variant requires ./pocketkuma. Run `bun run build` first.");
        }
    }

    const results = [];
    for (const variant of selectedVariants) {
        const samples = [];
        for (let trial = 1; trial <= trials; trial++) {
            console.error(`${variant.name}: trial ${trial}/${trials}`);
            samples.push(
                await runTrial({
                    name: variant.name,
                    command: variant.command,
                    readiness: variant.readiness,
                    requiresPort: variant.requiresPort,
                    timeoutMs,
                    warmupMs,
                })
            );
        }
        results.push({
            name: variant.name,
            synthetic: variant.synthetic,
            trials: samples.map(({ readinessMs, rssKb, footprintBytes, synthetic }) => ({
                readinessMs,
                rssKb,
                footprintBytes,
                synthetic,
            })),
            median: {
                readinessMs: median(samples.map((sample) => sample.readinessMs)),
                rssKb: median(samples.map((sample) => sample.rssKb).filter(Number.isFinite)),
                footprintBytes: samples.some((sample) => Number.isFinite(sample.footprintBytes))
                    ? median(samples.map((sample) => sample.footprintBytes).filter(Number.isFinite))
                    : null,
            },
        });
    }

    return {
        schema: 1,
        measuredAt: new Date().toISOString(),
        bunVersion: Bun.version,
        os: `${os.platform()} ${os.release()}`,
        arch: process.arch,
        gitSha: commandOutput(["git", "rev-parse", "HEAD"]).trim(),
        trials,
        warmupMs,
        timeoutMs,
        note: "Application variants use external RSS/footprint and existing GET / readiness. Synthetic variants also report Bun runtime metrics; those are separate metrics and are not application measurements. Results are a single-host baseline and must not be compared across hosts.",
        variants: results,
    };
}

function getOption(name, fallback) {
    const value = process.argv.find((arg) => arg.startsWith(`--${name}=`));
    return value ? value.slice(name.length + 3) : fallback;
}

async function main() {
    const report = await runBenchmark({
        trials: Number(getOption("trials", 3)),
        timeoutMs: Number(getOption("timeout-ms", defaultTimeoutMs)),
        warmupMs: Number(getOption("warmup-ms", defaultWarmupMs)),
        variantName: getOption("variant", ""),
    });
    const outfile = getOption("outfile", "");
    if (outfile) {
        fs.mkdirSync(path.dirname(path.resolve(projectRoot, outfile)), { recursive: true });
        fs.writeFileSync(path.resolve(projectRoot, outfile), `${JSON.stringify(report, null, 2)}\n`);
    }
    console.log(JSON.stringify(report, null, 2));
}

export { median, parseFootprintBytes, parseReadyLine, parseRssKb, readExternalMetrics, runTrial, stopProcess };

if (import.meta.main) {
    await main();
}
