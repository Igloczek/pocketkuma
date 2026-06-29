export default {
    apps: [
        {
            name: "uptime-kuma",
            script: "./src/server/server.ts",
            interpreter: "bun",
        },
    ],
};
