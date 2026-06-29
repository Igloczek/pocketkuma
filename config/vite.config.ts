// @ts-nocheck
import path from "path";
import postCssScss from "postcss-scss";
import postcssRTLCSS from "postcss-rtlcss";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import visualizer from "rollup-plugin-visualizer";
import viteCompression from "vite-plugin-compression";
import packageJson from "../package.json" with { type: "json" };

const viteCompressionFilter = /\.(js|mjs|json|css|html|svg)$/i;
const serviceWorkerEntry = path.resolve(import.meta.dirname, "../src/serviceWorker.ts");

function serviceWorkerDevRoute() {
    return {
        name: "uptime-buna-service-worker",
        configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
                const pathname = new URL(request.url || "/", "http://localhost").pathname;
                if (pathname !== "/serviceWorker.js") {
                    next();
                    return;
                }

                try {
                    const result = await server.transformRequest("/serviceWorker.ts");
                    if (!result) {
                        next();
                        return;
                    }
                    response.setHeader("Content-Type", "text/javascript; charset=utf-8");
                    response.end(result.code);
                } catch (error) {
                    next(error);
                }
            });
        },
    };
}

// https://vitejs.dev/config/
export default defineConfig({
    root: "src",
    publicDir: "../public",
    server: {
        port: 3000,
    },
    define: {
        FRONTEND_VERSION: JSON.stringify(packageJson.version),
        "process.env": {},
    },
    plugins: [
        vue(),
        serviceWorkerDevRoute(),
        visualizer({
            filename: "../tmp/dist-stats.html",
        }),
        viteCompression({
            algorithm: "gzip",
            filter: viteCompressionFilter,
        }),
        viteCompression({
            algorithm: "brotliCompress",
            filter: viteCompressionFilter,
        }),
    ],
    css: {
        postcss: {
            parser: postCssScss,
            map: false,
            plugins: [postcssRTLCSS],
        },
    },
    build: {
        outDir: "../dist",
        emptyOutDir: true,
        commonjsOptions: {
            include: [/.js$/],
        },
        rollupOptions: {
            input: {
                app: path.resolve(import.meta.dirname, "../src/index.html"),
                serviceWorker: serviceWorkerEntry,
            },
            output: {
                entryFileNames(chunkInfo) {
                    return chunkInfo.name === "serviceWorker" ? "serviceWorker.js" : "assets/[name]-[hash].js";
                },
                manualChunks(id, { getModuleInfo, getModuleIds }) {},
            },
        },
    },
});
