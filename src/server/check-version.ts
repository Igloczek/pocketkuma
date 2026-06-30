// @ts-nocheck

import { setSetting, setting } from "@/server/util-server";
import httpClient from "@/server/http-client";

import { log } from "@/util";
import packageJson from "@/package-meta";

export const version = packageJson.version;
export let latestVersion = null;

// How much time in ms to wait between update checks
const UPDATE_CHECKER_INTERVAL_MS = 1000 * 60 * 60 * 48;
const UPDATE_CHECKER_LATEST_VERSION_URL = "https://api.github.com/repos/Igloczek/pocketkuma/releases/latest";

let interval;

export const startInterval = () => {
    let check = async () => {
        if ((await setting("checkUpdate")) === false) {
            return;
        }

        log.debug("update-checker", "Retrieving latest versions");

        try {
            const res = await httpClient.get(UPDATE_CHECKER_LATEST_VERSION_URL);

            // For debug
            if (process.env.TEST_CHECK_VERSION === "1") {
                res.data.tag_name = "v1000.0.0";
            }

            const tagName = res.data?.tag_name;
            if (typeof tagName === "string") {
                latestVersion = tagName.replace(/^v/, "");
            }
        } catch (_) {
            log.info("update-checker", "Failed to check for new versions");
        }
    };

    check();
    interval = setInterval(check, UPDATE_CHECKER_INTERVAL_MS);
};

/**
 * Enable the check update feature
 * @param {boolean} value Should the check update feature be enabled?
 * @returns {Promise<void>}
 */
export const enableCheckUpdate = async (value) => {
    await setSetting("checkUpdate", value);

    clearInterval(interval);

    if (value) {
        startInterval();
    }
};

export let socket = null;

export default { version, latestVersion, startInterval, enableCheckUpdate, socket };
