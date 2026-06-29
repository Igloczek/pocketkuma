// @ts-nocheck

import { describe, test, expect } from "bun:test";
import { gameDig4to5IdMap } from "@/db/schema/gamedig-v4-to-v5-map";
import snapshot from "./fixtures/gamedig-v4-to-v5-map.snapshot.json";

describe("GameDig v4 to v5 map", () => {
    test("matches upstream Knex migration snapshot", () => {
        expect(gameDig4to5IdMap).toEqual(snapshot);
    });
});