// @ts-nocheck
"use strict";

import fs from "fs";

function toText(output) {
    return output ? output.toString("utf8") : "";
}

async function readBunStream(stream) {
    if (!stream) {
        return "";
    }
    return await new Response(stream).text();
}

async function runCommand(command, args = [], options = {}) {
    const subprocess = Bun.spawn([command, ...args], {
        cwd: options.cwd,
        env: options.env ? { ...process.env, ...options.env } : process.env,
        stdout: "pipe",
        stderr: "pipe",
    });

    let timeout;
    if (options.timeout) {
        timeout = setTimeout(() => subprocess.kill(), options.timeout);
    }

    try {
        const [stdout, stderr, code] = await Promise.all([
            readBunStream(subprocess.stdout),
            readBunStream(subprocess.stderr),
            subprocess.exited,
        ]);
        return { code, signal: null, stdout, stderr };
    } finally {
        clearTimeout(timeout);
    }
}

async function runCommandChecked(command, args = [], options = {}) {
    const result = await runCommand(command, args, options);
    if (result.code !== 0) {
        const error = new Error(result.stderr || result.stdout || `${command} exited with code ${result.code}`);
        error.result = result;
        throw error;
    }
    return result;
}

function runCommandSync(command, args = [], options = {}) {
    const result = Bun.spawnSync([command, ...args], {
        cwd: options.cwd,
        env: options.env ? { ...process.env, ...options.env } : process.env,
        stdout: "pipe",
        stderr: "pipe",
    });
    return {
        code: result.exitCode,
        signal: null,
        stdout: toText(result.stdout),
        stderr: toText(result.stderr),
    };
}

function startProcess(command, args = [], options = {}) {
    return Bun.spawn([command, ...args], {
        cwd: options.cwd,
        env: options.env ? { ...process.env, ...options.env } : process.env,
        stdout: "pipe",
        stderr: "pipe",
    });
}

async function commandExists(command) {
    if (!command) {
        return false;
    }

    if (command.includes("/") || command.includes("\\")) {
        try {
            await fs.promises.access(command, fs.constants.X_OK);
            return true;
        } catch (e) {
            return false;
        }
    }

    const result =
        process.platform === "win32"
            ? await runCommand("where", [command], { timeout: 5000 })
            : await runCommand("sh", ["-c", `command -v "$1"`, "sh", command], { timeout: 5000 });
    return result.code === 0;
}

export { commandExists, runCommand, runCommandChecked, runCommandSync, startProcess };
