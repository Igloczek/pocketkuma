// @ts-nocheck
import "bootstrap";
import { createApp, h } from "vue";
import contenteditable from "vue-contenteditable";
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";
import App from "@/App.vue";
import "@/assets/app.scss";
import "@/assets/vue-datepicker.scss";
import { i18n } from "@/i18n";
import { AppIcon } from "@/icon";
import { initLang } from "@/composables/useLang";
import { initMobile } from "@/composables/useMobile";
import { initTheme } from "@/composables/useTheme";
import appStoreMixin from "@/mixins/appStore";
import { router } from "@/router";
import { createPinia } from "pinia";
import { initAppStoreWatchers } from "@/stores/app";
import { appName } from "@/constants";
import dayjs from "dayjs";
import timezone from "@/modules/dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import relativeTime from "dayjs/plugin/relativeTime";
import { loadToastSettings } from "@/util-frontend";
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

const pinia = createPinia();

const app = createApp({
    mixins: [appStoreMixin],
    data() {
        return {
            appName: appName,
        };
    },
    render: () => h(App),
});

app.use(pinia);
app.use(router);
app.use(i18n);

initTheme(router);
initMobile();
initLang();

app.use(Toast, loadToastSettings());
app.component("Editable", contenteditable);
app.component("AppIcon", AppIcon);

initAppStoreWatchers();
app.mount("#app");

// Service Worker
// Mainly for Webpush notification
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/serviceWorker.js", { scope: "/" }).catch((error) => {
        console.error("Service worker registration failed:", error);
    });
}

// Expose the vue instance for development
if (process.env.NODE_ENV === "development") {
    console.log("Dev Only: window.app is the vue instance");
    window.app = app._instance;
}
