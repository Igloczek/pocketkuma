<template>
    <component is="style" v-if="customCSS" type="text/css">
        {{ customCSS }}
    </component>
</template>

<script>
export default {
    props: {
        customCSS: {
            type: String,
            default: "",
        },
    },
};
</script>
