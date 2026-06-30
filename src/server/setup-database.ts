// @ts-nocheck

/**
 * SQLite-only setup server.
 *
 * Fresh uptime-buna installs do not ask for a database backend. The fork uses
 * the local SQLite database path by default and rejects non-SQLite configs.
 */
import { log } from "@/util";
import { printServerUrls } from "@/server/util-server";
import { isSSL } from "@/server/config";
import { resolveRequestPath } from "@/server/bun-http-server";

class SetupDatabase {
    /**
     * Show Setup Page
     * @type {boolean}
     */
    needSetup = true;
    /**
     * If the server has finished the setup
     * @type {boolean}
     * @private
     */
    runningSetup = false;
    /**
     * @inheritDoc
     * @type {UptimeKumaServer}
     * @private
     */
    server;

    /**
     * @param  {object} args The arguments passed from the command line
     * @param  {UptimeKumaServer} server the main server instance
     */
    constructor(args, server) {
        this.server = server;
        this.needSetup = false;
    }

    /**
     * Show Setup Page
     * @returns {boolean} true if the setup page should be shown
     */
    isNeedSetup() {
        return this.needSetup;
    }

    /**
     * Start the setup-database server
     * @param {string} hostname where the server is listening
     * @param {number} port where the server is listening
     * @returns {Promise<void>}
     */
    start(hostname, port) {
        return this.startWithBunServe(hostname, port);
    }

    /**
     * Start the setup-database server with Bun.serve for the Bun runtime.
     * @param {string} hostname where the server is listening
     * @param {number} port where the server is listening
     * @returns {Promise<void>}
     */
    startWithBunServe(hostname, port) {
        const json = (body, status = 200) =>
            new Response(JSON.stringify(body), {
                status,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    Connection: "close",
                },
            });

        const redirect = (location) =>
            new Response(null, {
                status: 302,
                headers: {
                    Location: location,
                    Connection: "close",
                },
            });

        const serveIndex = () =>
            new Response(this.server.indexHTML, {
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    Connection: "close",
                },
            });

        return new Promise((resolve) => {
            let tempServer;

            tempServer = Bun.serve({
                hostname,
                port,
                fetch: async (request) => {
                    const url = new URL(request.url);

                    if (request.method === "GET" && url.pathname === "/") {
                        return redirect("/setup-database");
                    }

                    if (request.method === "GET" && url.pathname === "/api/entry-page") {
                        return json({
                            type: "setup-database",
                        });
                    }

                    if (request.method === "GET" && url.pathname === "/setup-database-info") {
                        console.log("Request /setup-database-info");
                        return json({
                            runningSetup: this.runningSetup,
                            needSetup: this.needSetup,
                        });
                    }

                    if (request.method === "POST" && url.pathname === "/setup-database") {
                        if (this.runningSetup) {
                            return json("Setup is already running", 400);
                        }

                        this.runningSetup = true;

                        try {
                            const body = await request.json().catch(() => ({}));
                            const dbConfig = body?.dbConfig;
                            if (dbConfig?.type && dbConfig.type !== "sqlite") {
                                throw new Error("Only SQLite is supported");
                            }

                            this.needSetup = false;
                        } catch (e) {
                            this.runningSetup = false;
                            return json(e.message, 400);
                        }

                        log.info(
                            "setup-database",
                            "SQLite is configured, close the setup-database server and start the main server now."
                        );
                        setTimeout(() => {
                            tempServer.stop(true);
                            resolve();
                        }, 50);
                        return json({
                            ok: true,
                        });
                    }

                    if (request.method === "OPTIONS") {
                        return new Response(null, {
                            headers: {
                                Connection: "close",
                            },
                        });
                    }

                    if (request.method === "GET") {
                        const filePath = resolveRequestPath("dist", url.pathname.replace(/^\//, ""));
                        if (filePath) {
                            const file = Bun.file(filePath);
                            if (!(await file.exists())) {
                                return serveIndex();
                            }
                            return new Response(file, {
                                headers: {
                                    Connection: "close",
                                },
                            });
                        }
                    }

                    return serveIndex();
                },
            });

            this.server.bunHttpServer = tempServer;
            log.info("setup-database", "Starting Setup Database");
            printServerUrls("setup-database", port, hostname, isSSL);
            log.info("setup-database", "Waiting for user action...");
        });
    }
}

export { SetupDatabase };
