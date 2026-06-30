// @ts-nocheck
import { ref, computed } from "vue";

const windowWidth = ref(window.innerWidth);

let initialized = false;

/**
 * Add css-class "mobile" to body if needed
 * @returns {void}
 */
function updateBody() {
    if (isMobile.value) {
        document.body.classList.add("mobile");
    } else {
        document.body.classList.remove("mobile");
    }
}

/**
 * Handle screen resize
 * @returns {void}
 */
function onResize() {
    windowWidth.value = window.innerWidth;
    updateBody();
}

const isMobile = computed(() => windowWidth.value <= 767.98);

/**
 * Initialize mobile resize listener (call once at app startup).
 * @returns {void}
 */
export function initMobile() {
    if (initialized) {
        return;
    }
    initialized = true;

    window.addEventListener("resize", onResize);
    updateBody();
}

/**
 * Mobile viewport state shared across the app.
 * @returns {object} Mobile composable API
 */
export function useMobile() {
    return {
        windowWidth,
        isMobile,
        onResize,
        updateBody,
    };
}
