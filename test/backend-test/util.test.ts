// @ts-nocheck

import { describe, test } from "node:test";
import assert from "node:assert";
import dayjs from "dayjs";
import { SQL_DATETIME_FORMAT } from "../../src/util.ts";
import dayjsPlugin_4 from "dayjs/plugin/utc";
import dayjsPlugin_5 from "dayjs/plugin/customParseFormat";

dayjs.extend(dayjsPlugin_4);
dayjs.extend(dayjsPlugin_5);

describe("Server Utilities", () => {
    test("SQL_DATETIME_FORMAT constant matches MariaDB/MySQL format", () => {
        assert.strictEqual(SQL_DATETIME_FORMAT, "YYYY-MM-DD HH:mm:ss");
    });

    test("SQL_DATETIME_FORMAT produces valid SQL datetime string", () => {
        const current = dayjs.utc("2025-12-19T01:04:02.129Z");
        const sqlFormat = current.utc().format(SQL_DATETIME_FORMAT);

        assert.strictEqual(sqlFormat, "2025-12-19 01:04:02");

        // Verify it can be parsed back
        const parsedDate = dayjs.utc(sqlFormat, SQL_DATETIME_FORMAT);
        assert.strictEqual(parsedDate.unix(), current.unix());
    });
});
