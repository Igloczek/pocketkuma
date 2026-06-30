// @ts-nocheck
import { ref, computed, watch } from "vue";

const system = ref(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
const userTheme = ref(localStorage.theme || "auto");
const userHeartbeatBar = ref(localStorage.heartbeatBarTheme || "normal");
const styleElapsedTime = ref(localStorage.styleElapsedTime || "no-line");
const statusPageTheme = ref("light");
const forceStatusPageTheme = ref(false);
const path = ref("");

let initialized = false;

/**
 * Update the theme color meta tag
 * @returns {void}
 */
function updateThemeColorMeta() {
    const themeColor = document.querySelector("#theme-color");
    if (!themeColor) {
        return;
    }

    if (theme.value === "dark") {
        themeColor.setAttribute("content", "#161B22");
    } else {
        themeColor.setAttribute("content", "#5cdd8b");
    }
}

const theme = computed(() => {
    if (forceStatusPageTheme.value) {
        if (statusPageTheme.value === "auto") {
            return system.value;
        }
        return statusPageTheme.value;
    }

    if (path.value === "") {
        return "light";
    }

    if (path.value.startsWith("/status-page") || path.value.startsWith("/status")) {
        if (statusPageTheme.value === "auto") {
            return system.value;
        }
        return statusPageTheme.value;
    }

    if (userTheme.value === "auto") {
        return system.value;
    }
    return userTheme.value;
});

const isDark = computed(() => theme.value === "dark");

/**
 * Initialize theme watchers and body classes (call once at app startup).
 * @param {import("vue-router").Router} router Vue router instance
 * @returns {void}
 */
export function initTheme(router) {
    if (initialized) {
        return;
    }
    initialized = true;

    watch(
        () => router.currentRoute.value.fullPath,
        (fullPath) => {
            path.value = fullPath;
        },
        { immediate: true }
    );

    watch(userTheme, (to) => {
        localStorage.theme = to;
    });

    watch(styleElapsedTime, (to) => {
        localStorage.styleElapsedTime = to;
    });

    watch(userHeartbeatBar, (to) => {
        localStorage.heartbeatBarTheme = to;
    });

    watch(theme, (to, from) => {
        if (from) {
            document.body.classList.remove(from);
        }
        document.body.classList.add(to);
        updateThemeColorMeta();
    });

    document.body.classList.add(theme.value);
    updateThemeColorMeta();
}

/**
 * Theme state and helpers shared across the app.
 * @returns {object} Theme composable API
 */
export function useTheme() {
    return {
        system,
        userTheme,
        userHeartbeatBar,
        styleElapsedTime,
        statusPageTheme,
        forceStatusPageTheme,
        path,
        theme,
        isDark,
        updateThemeColorMeta,
    };
}
