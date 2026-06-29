import { R } from "redbean-node";
import Database from "../../src/server/database.ts";
import { args } from "../../src/server/args.ts";
import { Settings } from "../../src/server/settings.ts";

const main = async () => {
    console.log("Connecting the database");
    Database.initDataDir(args);
    await Database.connect(false, false, true);

    console.log("Deleting all data from aggregate tables");
    await R.exec("DELETE FROM stat_minutely");
    await R.exec("DELETE FROM stat_hourly");
    await R.exec("DELETE FROM stat_daily");

    console.log("Resetting the aggregate table state");
    await Settings.set("migrateAggregateTableState", "");

    await Database.close();
    console.log("Done");
};

main();
