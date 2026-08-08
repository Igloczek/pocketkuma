import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const sourceRoots = ["src", "test", "scripts"];
const sourceExtension = /\.(?:[cm]?[jt]sx?|vue)$/;
const removedUtilitySpecifiers = ["@/util", "@/util-shared", "@/util-backend"];
const removedUtilityImport = new RegExp(
    String.raw`(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["'](?:${removedUtilitySpecifiers.join("|")})["']`
);

function importsRemovedUtility(source) {
    return removedUtilityImport.test(source);
}

describe("granular import boundaries", () => {
    test("recognizes every removed utility import form without matching purpose modules", () => {
        for (const specifier of removedUtilitySpecifiers) {
            expect(importsRemovedUtility(`import { value } from "${specifier}";`)).toBe(true);
            expect(importsRemovedUtility(`await import("${specifier}");`)).toBe(true);
            expect(importsRemovedUtility(`import "${specifier}";`)).toBe(true);
        }

        expect(importsRemovedUtility('import { sleep } from "@/util/sleep";')).toBe(false);
        expect(importsRemovedUtility('import "@/util/monitor-url";')).toBe(false);
    });

    test("does not restore the removed utility barrel", () => {
        const matches = sourceRoots.flatMap((root) =>
            fs
                .readdirSync(path.join(process.cwd(), root), { recursive: true })
                .filter((file) => sourceExtension.test(file))
                .map((file) => path.join(root, file))
                .filter((file) => importsRemovedUtility(fs.readFileSync(file, "utf8")))
        );

        expect(matches).toEqual([]);
    });

    test("keeps constants and logging independent from JSONata", async () => {
        const result = await Bun.build({
            entrypoints: ["src/constants.ts", "src/server/logger.ts"],
            target: "bun",
            write: false,
            metafile: true,
        });

        expect(result.success).toBe(true);
        expect(JSON.stringify(result.metafile)).not.toContain("jsonata");
    });
});
