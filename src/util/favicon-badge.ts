// @ts-nocheck
import Favico from "favico.js";

let favicon;
let faviconUpdateDebounce = null;

/**
 * Get or create the shared favicon badge instance.
 * @returns {object} Favico instance
 */
export function getFaviconBadge() {
    if (!favicon) {
        favicon = new Favico({
            animation: "none",
        });
    }

    return favicon;
}

/**
 * Update the favicon badge count with debouncing.
 * @param {number} count Badge count
 * @param {number} debounceMs Debounce delay in milliseconds
 * @returns {void}
 */
export function updateFaviconBadge(count, debounceMs = 1000) {
    if (faviconUpdateDebounce != null) {
        clearTimeout(faviconUpdateDebounce);
    }

    faviconUpdateDebounce = setTimeout(() => {
        getFaviconBadge().badge(count);
    }, debounceMs);
}
