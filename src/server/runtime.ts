// @ts-nocheck
"use strict";

function getRuntimeInfo() {
    if (typeof Bun !== "undefined") {
        return {
            name: "bun",
            version: Bun.version,
            platform: process.platform,
            arch: process.arch,
        };
    }

    return {
        name: "node",
        version: process.versions.node,
        platform: process.platform,
        arch: process.arch,
    };
}

function isBunRuntime() {
    return typeof Bun !== "undefined";
}

module.exports = {
    getRuntimeInfo,
    isBunRuntime,
};
