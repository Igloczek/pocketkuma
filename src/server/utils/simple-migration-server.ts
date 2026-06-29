// @ts-nocheck

import { printServerUrls } from "../util-server.ts";

const encoder = new TextEncoder();

/**
 * SimpleMigrationServer
 * For displaying the migration status of the server
 * Also, it is used to let Docker healthcheck know the status of the server, as the main server is not started yet, healthcheck will think the server is down incorrectly.
 */
class SimpleMigrationServer {
    /**
     * Server instance
     * @type {?Server}
     */
    server;

    /**
     * Active stream controller
     * @type {?ReadableStreamDefaultController}
     */
    responseController;

    /**
     * Start the server
     * @param {number} port Port
     * @param {string} hostname Hostname
     * @returns {Promise<void>}
     */
    start(port, hostname) {
        this.server = Bun.serve({
            hostname,
            port,
            fetch: (request) => {
                const url = new URL(request.url);

                if (request.method === "GET" && url.pathname === "/") {
                    // Don't use meta tag redirect, it may cause issues in Chrome (#6223)
                    return new Response(
                        `
                <html lang="en">
                <head><title>Uptime Kuma Migration</title></head>
                <body>
                    Migration is in progress, it may take some time. You can check the progress in the console, or
                    <a href="/migrate-status" target="_blank">click here to check</a>.
                </body>
                </html>
            `,
                        {
                            headers: {
                                "Content-Type": "text/html; charset=utf-8",
                            },
                        }
                    );
                }

                if (request.method === "GET" && url.pathname === "/migrate-status") {
                    if (this.responseController) {
                        this.responseController.enqueue(encoder.encode("Disconnected\n"));
                        this.responseController.close();
                    }

                    const stream = new ReadableStream({
                        start: (controller) => {
                            controller.enqueue(encoder.encode("Migration is in progress, listening message...\n"));
                            this.responseController = controller;
                        },
                        cancel: () => {
                            if (this.responseController) {
                                this.responseController = null;
                            }
                        },
                    });

                    return new Response(stream, {
                        headers: {
                            "Content-Type": "text/plain; charset=utf-8",
                        },
                    });
                }

                return new Response("Not Found", {
                    status: 404,
                    headers: {
                        "Content-Type": "text/plain; charset=utf-8",
                    },
                });
            },
        });

        printServerUrls("migration", port, hostname);
        return Promise.resolve();
    }

    /**
     * Update the message
     * @param {string} msg Message to update
     * @returns {void}
     */
    update(msg) {
        this.responseController?.enqueue(encoder.encode(msg + "\n"));
    }

    /**
     * Stop the server
     * @returns {Promise<void>}
     */
    async stop() {
        this.responseController?.enqueue(encoder.encode("Finished, please refresh this page.\n"));
        this.responseController?.close();
        this.responseController = null;
        this.server?.stop(true);
    }
}

export { SimpleMigrationServer };
