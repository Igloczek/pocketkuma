// @ts-nocheck

import fs from "fs";
import util from "util";
import path from "path";
import dayjs from "dayjs";
import Database from "@/server/database";
import { log } from "@/util";

export function writeErrorLog(error, outputToConsole = true) {
    const stream = fs.createWriteStream(path.join(Database.dataDir, "/error.log"), { flags: "a" });
    stream.on("error", () => log.info("", "Cannot write to error.log"));
    stream.write(`[${dayjs.utc().format("YYYY-MM-DD HH:mm:ss")}] ${util.format(error)}\n`);
    if (outputToConsole) {
        console.error(error);
    }
    stream.end();
}
