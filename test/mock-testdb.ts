import { sync as rimrafSync } from "rimraf";
import Database from "../src/server/database.ts";

class TestDB {
    dataDir;

    constructor(dir = "./data/test") {
        this.dataDir = dir;
    }

    async create() {
        Database.initDataDir({ "data-dir": this.dataDir });
        Database.dbConfig = {
            type: "sqlite",
        };
        Database.writeDBConfig(Database.dbConfig);
        await Database.connect(true);
        await Database.patch();
    }

    async destroy() {
        await Database.close();
        this.dataDir && rimrafSync(this.dataDir);
    }
}

export default TestDB;
