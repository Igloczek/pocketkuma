import http from "node:http";
import https from "node:https";

const isFreeBSD = /^freebsd/.test(process.platform);
const isKubernetesPortEnv = process.env.UPTIME_KUMA_PORT?.startsWith("tcp://") ?? false;

const sslKey = process.env.UPTIME_KUMA_SSL_KEY || process.env.SSL_KEY;
const sslCert = process.env.UPTIME_KUMA_SSL_CERT || process.env.SSL_CERT;
const protocol = sslKey && sslCert ? "https:" : "http:";

let hostname = process.env.UPTIME_KUMA_HOST;
if (!hostname && !isFreeBSD) {
    hostname = process.env.HOST;
}

let port = isKubernetesPortEnv ? undefined : process.env.UPTIME_KUMA_PORT;
port ||= process.env.PORT || "3001";

const client = protocol === "https:" ? https : http;
const request = client.request(
    {
        protocol,
        hostname: hostname || "127.0.0.1",
        port,
        method: "GET",
        timeout: 28_000,
        rejectUnauthorized: false,
    },
    (response) => {
        response.resume();
        response.on("end", () => {
            const statusCode = response.statusCode ?? 0;
            console.log(`Health Check OK [Res Code: ${statusCode}]`);
            process.exit(statusCode >= 200 && statusCode < 400 ? 0 : 1);
        });
    }
);

request.on("timeout", () => {
    request.destroy(new Error("Healthcheck request timed out"));
});

request.on("error", (error) => {
    console.error(`Health Check ERROR: ${error.message}`);
    process.exit(1);
});

request.end();
