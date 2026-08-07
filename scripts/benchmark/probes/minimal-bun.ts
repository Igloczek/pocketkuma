const memoryUsage = process.memoryUsage();
const unsafeMemoryFootprint = typeof Bun.unsafe?.memoryFootprint === "function" ? Bun.unsafe.memoryFootprint() : null;

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
