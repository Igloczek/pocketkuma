import { sync as rimrafSync } from "rimraf";
import Database from "@/server/database";
import { BunSQLiteRedbean } from "@/server/sqlite-core";
import "@/server/model-registry";

class TestDB {
    dataDir;

    constructor(dir = "./data/test") {
        this.dataDir = dir;
        this.store = new BunSQLiteRedbean();
    }

    async create() {
        Database.initDataDir({ "data-dir": this.dataDir });
        await Database.connect(this.store, true);
    }

    async destroy() {
        await Database.close(this.store);
        this.dataDir && rimrafSync(this.dataDir);
    }
}

export default TestDB;
