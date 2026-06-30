// @ts-nocheck
"use strict";

function getRuntimeInfo() {
    return {
        name: "bun",
        version: Bun.version,
        platform: process.platform,
        arch: process.arch,
    };
}

function isBunRuntime() {
    return typeof Bun !== "undefined";
}

export { getRuntimeInfo, isBunRuntime };
