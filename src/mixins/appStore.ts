// @ts-nocheck
import { useAppStore } from "@/stores/app";

export default {
    computed: {
        appStore() {
            return useAppStore();
        },
    },
};
