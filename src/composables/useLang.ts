// @ts-nocheck
import { ref, watch } from "vue";
import { currentLocale, i18n } from "@/i18n";
import { setDurationFormatLocale, setPageLocale } from "@/util-frontend";

const langModules = import.meta.glob("../lang/*.json");

const language = ref(currentLocale());

let initialized = false;

/**
 * Change the application language
 * @param {string} lang Language code to switch to
 * @returns {Promise<void>}
 */
async function changeLang(lang) {
    const message = (await langModules["../lang/" + lang + ".json"]()).default;
    i18n.global.setLocaleMessage(lang, message);
    i18n.global.locale = lang;
    localStorage.locale = lang;
    setPageLocale();
    setDurationFormatLocale(lang);
}

/**
 * Initialize language watcher and load non-English locale (call once at app startup).
 * @returns {void}
 */
export function initLang() {
    if (initialized) {
        return;
    }
    initialized = true;

    if (language.value !== "en") {
        changeLang(language.value);
    }

    watch(language, async (lang) => {
        await changeLang(lang);
    });
}

/**
 * Language state and helpers shared across the app.
 * @returns {object} Language composable API
 */
export function useLang() {
    return {
        language,
        changeLang,
    };
}
