const port = Number(process.env.BENCHMARK_PORT);
const memoryUsage = process.memoryUsage();
const unsafeMemoryFootprint = typeof Bun.unsafe?.memoryFootprint === "function" ? Bun.unsafe.memoryFootprint() : null;

Bun.serve({
    hostname: "127.0.0.1",
    port,
    fetch() {
        return new Response("ok");
    },
});

console.log(
    JSON.stringify({
        event: "ready",
        synthetic: {
            processRssBytes: memoryUsage.rss,
            heapUsedBytes: memoryUsage.heapUsed,
            unsafeMemoryFootprintBytes: unsafeMemoryFootprint,
        },
    })
);

await new Promise(() => {});
