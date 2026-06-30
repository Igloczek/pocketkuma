// @ts-nocheck

import { Settings } from "@/server/settings";

/**
 * Retrieve value of setting based on key
 * @param {string} key Key of setting to retrieve
 * @returns {Promise<any>} Value
 * @deprecated Use await Settings.get(key)
 */
export async function setting(key) {
    return await Settings.get(key);
}

/**
 * Sets the specified setting to specified value
 * @param {string} key Key of setting to set
 * @param {any} value Value to set to
 * @param {?string} type Type of setting
 * @returns {Promise<void>}
 */
export async function setSetting(key, value, type = null) {
    await Settings.set(key, value, type);
}

/**
 * Get settings based on type
 * @param {string} type The type of setting
 * @returns {Promise<Bean>} Settings of requested type
 */
export async function getSettings(type) {
    return await Settings.getSettings(type);
}

/**
 * Set settings based on type
 * @param {string} type Type of settings to set
 * @param {object} data Values of settings
 * @returns {Promise<void>}
 */
export async function setSettings(type, data) {
    await Settings.setSettings(type, data);
}