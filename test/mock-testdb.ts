import { sync as rimrafSync } from "rimraf";
import Database from "@/server/database";
import { R } from "@/server/bun-sqlite-store";

class TestDB {
    dataDir;

    constructor(dir = "./data/test") {
        this.dataDir = dir;
    }

    async create() {
        Database.initDataDir({ "data-dir": this.dataDir });
        await Database.connect(R, true);
    }

    async destroy() {
        await Database.close(R);
        this.dataDir && rimrafSync(this.dataDir);
    }
}

export default TestDB;
