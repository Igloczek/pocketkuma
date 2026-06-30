<template>
    <svg
        v-if="iconData"
        xmlns="http://www.w3.org/2000/svg"
        :viewBox="`0 0 ${iconData.width} ${iconData.height}`"
        class="app-icon"
        :class="[$attrs.class, { 'app-icon-spin': spin, 'app-icon-fw': fixedWidth }]"
        :style="[$attrs.style, sizeStyle]"
        :aria-hidden="ariaHidden"
        :aria-label="ariaLabel"
        role="img"
        focusable="false"
    >
        <title v-if="title">{{ title }}</title>
        <path v-for="(path, index) in iconData.paths" :key="index" :d="path" fill="currentColor" />
    </svg>
</template>

<script>
import { iconPaths } from "@/icons/paths";

const sizeMap = {
    "2x": "2em",
};

export default {
    inheritAttrs: false,
    props: {
        icon: {
            type: String,
            required: true,
        },
        size: {
            type: String,
            default: undefined,
        },
        spin: {
            type: Boolean,
            default: false,
        },
        fixedWidth: {
            type: Boolean,
            default: false,
        },
        title: {
            type: String,
            default: undefined,
        },
        ariaHidden: {
            type: [Boolean, String],
            default: undefined,
        },
        ariaLabel: {
            type: String,
            default: undefined,
        },
    },
    computed: {
        iconData() {
            return iconPaths[this.icon];
        },
        sizeStyle() {
            if (!this.size) {
                return undefined;
            }

            const fontSize = sizeMap[this.size] ?? this.size;
            return { fontSize };
        },
    },
};
</script>

<style scoped>
.app-icon {
    display: inline-block;
    height: 1em;
    overflow: visible;
    vertical-align: -0.125em;
}

.app-icon-fw {
    text-align: center;
    width: 1.25em;
}

.app-icon-spin {
    animation: app-icon-spin-keyframes 2s linear infinite;
}

@keyframes app-icon-spin-keyframes {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}
</style>