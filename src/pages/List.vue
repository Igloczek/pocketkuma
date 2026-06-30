<template>
    <transition name="slide-fade" appear>
        <MonitorList :scrollbar="true" />
    </transition>
</template>

<script>
import MonitorList from "@/components/MonitorList.vue";
import { useMobile } from "@/composables/useMobile";

export default {
    components: {
        MonitorList,
    },
    setup() {
        return useMobile();
    },
    watch: {
        isMobile(newVal) {
            if (!newVal && this.$route.path === "/list") {
                this.$router.replace({ path: "/dashboard" });
            }
        },
    },
    mounted() {
        if (!this.isMobile && this.$route.path === "/list") {
            this.$router.replace({ path: "/dashboard" });
        }
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.shadow-box {
    padding: 20px;
}
</style>
