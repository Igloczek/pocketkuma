// @ts-nocheck

import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const projectRoot = path.join(import.meta.dirname, "../..");
const binaryPath = process.env.POCKETKUMA_BINARY ? path.resolve(projectRoot, process.env.POCKETKUMA_BINARY) : null;

let appProcess;
let dataDir;
let realtimeSocket;
let smtpServer;

function withTimeout(promise, timeout, message) {
    let timeoutID;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timeoutID = setTimeout(() => reject(new Error(message)), timeout);
        }),
    ]).finally(() => clearTimeout(timeoutID));
}

function reservePort() {
    const listener = Bun.listen({
        hostname: "127.0.0.1",
        port: 0,
        socket: {
            data() {},
        },
    });
    const port = listener.port;
    listener.stop(true);
    return port;
}

function startSMTPServer() {
    let receivedMessage = false;
    const state = new WeakMap();

    const server = Bun.listen({
        hostname: "127.0.0.1",
        port: 0,
        socket: {
            open(socket) {
                state.set(socket, { buffer: "", receivingData: false });
                socket.write("220 pocketkuma-test ESMTP\r\n");
            },
            data(socket, chunk) {
                const connection = state.get(socket);
                connection.buffer += chunk.toString();

                if (connection.receivingData) {
                    if (connection.buffer.includes("\r\n.\r\n")) {
                        receivedMessage = true;
                        connection.buffer = "";
                        connection.receivingData = false;
                        socket.write("250 Message accepted\r\n");
                    }
                    return;
                }

                let lineEnd;
                while ((lineEnd = connection.buffer.indexOf("\r\n")) !== -1) {
                    const command = connection.buffer.slice(0, lineEnd);
                    connection.buffer = connection.buffer.slice(lineEnd + 2);

                    if (/^EHLO\b/i.test(command)) {
                        socket.write("250-pocketkuma-test\r\n250 PIPELINING\r\n");
                    } else if (/^DATA$/i.test(command)) {
                        connection.receivingData = true;
                        socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
                        break;
                    } else if (/^QUIT$/i.test(command)) {
                        socket.end("221 Bye\r\n");
                    } else {
                        socket.write("250 OK\r\n");
                    }
                }
            },
            error() {},
        },
    });

    return {
        server,
        receivedMessage: () => receivedMessage,
    };
}

async function waitForApp(url) {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
        if (appProcess.exitCode !== null) {
            const stderr = appProcess.stderr ? await new Response(appProcess.stderr).text() : "";
            throw new Error(
                `PocketKuma exited before becoming ready (exit ${appProcess.exitCode})${stderr ? `: ${stderr.trim()}` : ""}`
            );
        }
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
        } catch {}
        await Bun.sleep(100);
    }
    throw new Error("PocketKuma did not become ready within 30 seconds");
}

async function startApp() {
    for (let attempt = 0; attempt < 3; attempt++) {
        const appPort = reservePort();
        appProcess = Bun.spawn([binaryPath, `--port=${appPort}`, "--host=127.0.0.1", `--data-dir=${dataDir}`], {
            cwd: projectRoot,
            env: {
                ...process.env,
                NODE_ENV: "production",
                UPTIME_KUMA_WS_ORIGIN_CHECK: "bypass",
            },
            stdout: "ignore",
            stderr: "pipe",
        });

        try {
            await waitForApp(`http://127.0.0.1:${appPort}`);
            return appPort;
        } catch (error) {
            const retry = appProcess.exitCode !== null && /EADDRINUSE/.test(error.message) && attempt < 2;
            if (!retry) {
                throw error;
            }
            await appProcess.exited;
            appProcess = undefined;
        }
    }
}

async function connectRealtime(url) {
    const socket = new WebSocket(url);
    const callbacks = new Map();
    let nextID = 1;
    let handlersReady;

    const ready = new Promise((resolve, reject) => {
        socket.addEventListener("error", () => reject(new Error("WebSocket connection failed")), { once: true });
        socket.addEventListener("close", () => reject(new Error("WebSocket closed before login handlers were ready")), {
            once: true,
        });
        socket.addEventListener("message", (event) => {
            const message = JSON.parse(String(event.data));
            if (message.type === "event" && message.event === "loginRequired") {
                handlersReady = true;
                resolve();
            } else if ((message.type === "reply" || message.type === "error") && message.id) {
                const callback = callbacks.get(message.id);
                if (callback) {
                    callbacks.delete(message.id);
                    if (message.type === "error") {
                        callback.reject(new Error(message.message));
                    } else {
                        callback.resolve(message.args?.[0]);
                    }
                }
            }
        });
    });

    await withTimeout(ready, 10_000, "WebSocket login handlers were not ready");

    return {
        socket,
        request(event, ...args) {
            if (!handlersReady) {
                throw new Error("WebSocket handlers are not ready");
            }
            const id = String(nextID++);
            const reply = new Promise((resolve, reject) => callbacks.set(id, { resolve, reject }));
            socket.send(JSON.stringify({ type: "event", event, args, id }));
            return withTimeout(reply, 10_000, `No reply for WebSocket event ${event}`);
        },
    };
}

async function stopApp() {
    if (!appProcess || appProcess.exitCode !== null) {
        return;
    }
    appProcess.kill("SIGTERM");
    try {
        await withTimeout(appProcess.exited, 5_000, "PocketKuma did not stop after SIGTERM");
    } catch {
        appProcess.kill("SIGKILL");
        await appProcess.exited;
    }
}

afterEach(async () => {
    realtimeSocket?.close();
    smtpServer?.stop(true);
    await stopApp();
    if (dataDir) {
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
});

describe("compiled notification provider loading", () => {
    test("compiled executable sends an SMTP test notification through the production socket flow", async () => {
        expect(binaryPath, "POCKETKUMA_BINARY must point to a compiled PocketKuma executable").toBeTruthy();
        expect(fs.existsSync(binaryPath)).toBe(true);

        dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pocketkuma-compiled-smtp-"));
        const smtp = startSMTPServer();
        smtpServer = smtp.server;

        const appPort = await startApp();

        const realtime = await connectRealtime(`ws://127.0.0.1:${appPort}/ws`);
        realtimeSocket = realtime.socket;

        const setup = await realtime.request("setup", "compiled-test", "compiled-test-password");
        expect(setup.ok).toBe(true);

        const login = await realtime.request("login", {
            username: "compiled-test",
            password: "compiled-test-password",
            token: "",
        });
        expect(login.ok).toBe(true);

        const result = await realtime.request("testNotification", {
            type: "smtp",
            name: "Compiled SMTP",
            smtpHost: "127.0.0.1",
            smtpPort: smtpServer.port,
            smtpSecure: false,
            smtpIgnoreSTARTTLS: true,
            smtpFrom: "sender@example.invalid",
            smtpTo: "recipient@example.invalid",
        });

        expect(result).toEqual({ ok: true, msg: "Sent Successfully." });
        expect(smtp.receivedMessage()).toBe(true);
    }, 60_000);
});
