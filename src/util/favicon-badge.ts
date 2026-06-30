// @ts-nocheck

import Favico from "favico.js";

let favicon;

/**
 * Initialize the shared favicon badge helper.
 * @returns {object} Favico instance.
 */
function initFaviconBadge() {
    if (!favicon) {
        favicon = new Favico({
            animation: "none",
        });
    }
    return favicon;
}

/**
 * Update the favicon badge count.
 * @param {number} count Number of down monitors to display.
 * @returns {void}
 */
function updateFaviconBadge(count) {
    initFaviconBadge().badge(count);
}

export { initFaviconBadge, updateFaviconBadge };