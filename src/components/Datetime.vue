<template>
    <span>{{ displayText }}</span>
</template>

<script>
import { useDatetime } from "@/composables/useDatetime";

export default {
    props: {
        /** Value of date time */
        value: {
            type: String,
            default: null,
        },
        /** Should only the date be displayed? */
        dateOnly: {
            type: Boolean,
            default: false,
        },
    },

    setup() {
        const { date, datetime } = useDatetime();
        return { date, datetime };
    },

    computed: {
        displayText() {
            if (this.dateOnly) {
                return this.date(this.value);
            }
            return this.datetime(this.value);
        },
    },
};
</script>
