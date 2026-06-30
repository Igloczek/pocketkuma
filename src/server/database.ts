// @ts-nocheck

/**
 * Database & App Data Folder
 */
import fs from "fs";
import { R } from "@/server/redbean-compat";

const fsAsync = fs.promises;
import { log, isDev } from "@/util";
import { runCommandSync } from "@/server/process-helper";
import path from "path";
import kumaDbTemplate from "@/db/kuma.db" with { type: "file" };
import { defaultDataDir, isCompiledBinary } from "@/server/app-paths";

class Database {
    /**
     * Bootstrap database for SQLite
     * @type {string}
     */
    static templatePath = "./src/db/kuma.db";

    /**
     * Data Dir (Default: ./data)
     * @type {string}
     */
    static dataDir;

    /**
     * User Upload Dir (Default: ./data/upload)
     * @type {string}
     */
    static uploadDir;

    /**
     * Chrome Screenshot Dir (Default: ./data/screenshots)
     * @type {string}
     */
    static screenshotDir;

    /**
     * SQLite file path (Default: ./data/kuma.db)
     * @type {string}
     */
    static sqlitePath;

    /**
     * For storing Docker TLS certs (Default: ./data/docker-tls)
     * @type {string}
     */
    static dockerTLSDir;

    static dbConfig = { type: "sqlite" };

    /**
     * Initialize the data directory
     * @param {object} args Arguments to initialize DB with
     * @returns {void}
     */
    static getTemplatePath() {
        return isCompiledBinary() ? kumaDbTemplate : Database.templatePath;
    }

    static initDataDir(args) {
        // Data Directory (must be end with "/")
        const fallbackDataDir = isCompiledBinary() ? defaultDataDir() : "./data/";
        Database.dataDir = process.env.DATA_DIR || args["data-dir"] || Database.getDevDataDir() || fallbackDataDir;

        Database.sqlitePath = path.join(Database.dataDir, "kuma.db");
        if (!fs.existsSync(Database.dataDir)) {
            fs.mkdirSync(Database.dataDir, { recursive: true });
        }

        Database.uploadDir = path.join(Database.dataDir, "upload/");

        if (!fs.existsSync(Database.uploadDir)) {
            fs.mkdirSync(Database.uploadDir, { recursive: true });
        }

        // Create screenshot dir
        Database.screenshotDir = path.join(Database.dataDir, "screenshots/");
        if (!fs.existsSync(Database.screenshotDir)) {
            fs.mkdirSync(Database.screenshotDir, { recursive: true });
        }

        Database.dockerTLSDir = path.join(Database.dataDir, "docker-tls/");
        if (!fs.existsSync(Database.dockerTLSDir)) {
            fs.mkdirSync(Database.dockerTLSDir, { recursive: true });
        }

        log.info("server", `Data Dir: ${Database.dataDir}`);
    }

    /**
     * Development + non-master branch + no custom only
     * To avoid database migration issue during different pull request testing.
     * Path: ./data/dev-data/<git branch name>/
     * @returns {string} The dev data dir, empty string if not in dev mode or in master branch
     */
    static getDevDataDir() {
        if (isDev) {
            const gitBranch = this.getCurrentGitBranch();

            // HEAD means detached head. Don't handle this case, becasuse it is not common.
            if (gitBranch !== "" && gitBranch !== "master" && gitBranch !== "HEAD") {
                log.info("server", `Using development data directory for branch ${gitBranch}`);
                return path.join("./data/dev-data/", gitBranch, "/");
            } else {
                log.debug("server", "Do not use development data directory because it is master branch");
            }
        }
        return "";
    }

    /**
     * Get the current git branch name
     * @returns {string} The current git branch name, or empty string if it cannot be determined
     */
    static getCurrentGitBranch() {
        try {
            // Reference: https://stackoverflow.com/questions/6245570/how-do-i-get-the-current-branch-name-in-git
            return runCommandSync("git", ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
        } catch {
            return "";
        }
    }

    /**
     * Read the database config
     * @throws {Error} If the config is invalid
     * @returns {{type: "sqlite"}} Database config
     */
    static readDBConfig() {
        let dbConfig;

        let dbConfigString = fs.readFileSync(path.join(Database.dataDir, "db-config.json")).toString("utf-8");
        dbConfig = JSON.parse(dbConfigString);

        if (typeof dbConfig !== "object") {
            throw new Error("Invalid db-config.json, it must be an object");
        }

        if (typeof dbConfig.type !== "string") {
            throw new Error("Invalid db-config.json, type must be a string");
        }
        if (dbConfig.type !== "sqlite") {
            throw new Error("Invalid db-config.json, uptime-buna supports SQLite only");
        }
        return dbConfig;
    }

    /**
     * @param {{type: "sqlite"}} dbConfig the database configuration that should be written
     * @returns {void}
     */
    static writeDBConfig(dbConfig) {
        if (!dbConfig || dbConfig.type !== "sqlite") {
            throw new Error("uptime-buna supports SQLite only");
        }
        fs.writeFileSync(path.join(Database.dataDir, "db-config.json"), JSON.stringify({ type: "sqlite" }, null, 4));
    }

    /**
     * Connect to the database
     * @param {boolean} testMode Should the connection be started in test mode?
     * @param {boolean} autoloadModels Should models be automatically loaded?
     * @param {boolean} noLog Should logs not be output?
     * @returns {Promise<void>}
     */
    static async connect(testMode = false, autoloadModels = true, noLog = false) {
        let dbConfig;
        try {
            dbConfig = this.readDBConfig();
        } catch (err) {
            if (err.message.includes("supports SQLite only")) {
                throw err;
            }
            log.warn("db", err.message);
            dbConfig = {
                type: "sqlite",
            };
            this.writeDBConfig(dbConfig);
        }

        if (dbConfig.type !== "sqlite") {
            throw new Error("uptime-buna supports SQLite only.");
        }

        Database.dbConfig = dbConfig;
        log.info("db", "Database Type: sqlite (bun:sqlite)");
        await R.connect({
            sqlitePath: Database.sqlitePath,
            templatePath: Database.getTemplatePath(),
            testMode,
        });
        if (autoloadModels) {
            await R.autoloadModels("./src/server/model");
        }
        if (!noLog) {
            log.debug("db", "SQLite config:");
            log.debug("db", await R.getAll("PRAGMA journal_mode"));
            log.debug("db", await R.getAll("PRAGMA cache_size"));
            log.debug("db", "SQLite Version: " + (await R.getCell("SELECT sqlite_version()")));
        }
    }

    /**
     * @returns {Promise<void>}
     */
    static async close() {
        log.info("db", "Closing the database");

        // Flush WAL to main database
        if (Database.dbConfig.type === "sqlite") {
            await R.exec("PRAGMA wal_checkpoint(TRUNCATE)");
        }

        await R.close();
        log.info("db", "Database closed");
    }

    /**
     * Get the size of the database (SQLite only)
     * @returns {Promise<number>} Size of database
     */
    static async getSize() {
        if (Database.dbConfig.type === "sqlite") {
            log.debug("db", "Database.getSize()");
            let stats = await fsAsync.stat(Database.sqlitePath);
            log.debug("db", stats);
            return stats.size;
        }
        return 0;
    }

    /**
     * Shrink the database
     * @returns {Promise<void>}
     */
    static async shrink() {
        if (Database.dbConfig.type === "sqlite") {
            await R.exec("VACUUM");
        }
    }

    /**
     * @returns {string} Get the SQL for the current time plus a number of hours
     */
    static sqlHourOffset() {
        return "DATETIME('now', ? || ' hours')";
    }

    /**
     * Remove all non-important heartbeats from heartbeat table, keep last 24-hour or {KEEP_LAST_ROWS} rows for each monitor
     * @param {boolean} detailedLog Log detailed information
     * @returns {Promise<void>}
     */
    static async clearHeartbeatData(detailedLog = false) {
        let monitors = await R.getAll("SELECT id FROM monitor");
        const sqlHourOffset = Database.sqlHourOffset();

        for (let monitor of monitors) {
            if (detailedLog) {
                log.info("db", "Deleting non-important heartbeats for monitor " + monitor.id);
            }
            await R.exec(
                `
                DELETE FROM heartbeat
                WHERE monitor_id = ?
                AND important = 0
                AND time < ${sqlHourOffset}
                AND id NOT IN (
                    SELECT id FROM (
                        SELECT id
                        FROM heartbeat
                        WHERE monitor_id = ?
                        ORDER BY time DESC
                        LIMIT ?
                    )  AS limited_ids
                )
            `,
                [monitor.id, -24, monitor.id, 100]
            );
        }
    }
}

export default Database;