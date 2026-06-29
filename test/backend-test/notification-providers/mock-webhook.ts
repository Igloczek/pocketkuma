// @ts-nocheck
/**
 * @param {number} port Port number
 * @param {string} url Webhook URL
 * @param {number} timeout Timeout
 * @returns {Promise<object>} Webhook data
 */
async function mockWebhook(port, url, timeout = 2500) {
    return new Promise((resolve, reject) => {
        const path = `/${url.replace(/^\//, "")}`;
        let server;
        const tmo = setTimeout(() => {
            server?.stop(true);
            reject({ reason: "Timeout" });
        }, timeout);

        server = Bun.serve({
            port,
            fetch: async (request) => {
                const requestUrl = new URL(request.url);
                if (request.method !== "POST" || requestUrl.pathname !== path) {
                    return new Response("Not Found", { status: 404 });
                }

                let body = {};
                try {
                    body = await request.json();
                } catch {
                    body = {};
                }

                tmo && clearTimeout(tmo);
                queueMicrotask(() => server.stop(true));
                resolve(body);
                return new Response("OK");
            },
        });
    });
}

export default mockWebhook;
