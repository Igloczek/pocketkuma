import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const sourceRoots = ["src", "test", "scripts"];
const sourceExtension = /\.(?:[cm]?[jt]sx?|vue)$/;
const removedUtilitySpecifiers = ["@/util", "@/util-shared", "@/util-backend"];
const lazyMonitorInputs = [
    "src/server/ping.ts",
    "src/server/radius.ts",
    "src/server/kafka.ts",
    "src/server/json-query.ts",
    "src/server/tls-cert.ts",
];
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

    test("loads optional monitor features through dynamic bundle edges", async () => {
        const result = await Bun.build({
            entrypoints: ["src/server/model/monitor.ts"],
            target: "bun",
            bundle: true,
            format: "esm",
            splitting: true,
            outdir: "out",
            write: false,
            metafile: true,
        });
        const outputs = Object.values(result.metafile.outputs);
        const monitorOutput = outputs.find((output) => output.entryPoint === "src/server/model/monitor.ts");
        const dynamicInputs = monitorOutput.imports
            .filter((output) => output.kind === "dynamic-import")
            .flatMap((output) => Object.keys(result.metafile.outputs[output.path].inputs));

        expect(Object.keys(monitorOutput.inputs)).not.toEqual(expect.arrayContaining(lazyMonitorInputs));
        expect(dynamicInputs).toEqual(expect.arrayContaining(lazyMonitorInputs));
    });
});
