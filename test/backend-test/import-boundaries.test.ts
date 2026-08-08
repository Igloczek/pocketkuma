import { describe, expect, test } from "bun:test";

const lazyMonitorInputs = [
    "src/server/ping.ts",
    "src/server/radius.ts",
    "src/server/kafka.ts",
    "src/server/json-query.ts",
    "src/server/tls-cert.ts",
];

describe("compiled import boundaries", () => {
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
