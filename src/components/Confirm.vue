<template>
    <div ref="modal" class="modal fade" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 id="exampleModalLabel" class="modal-title">
                        {{ title || $t("Confirm") }}
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" :aria-label="$t('Close')" />
                </div>
                <div class="modal-body">
                    <slot />
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn" :class="btnStyle" @click="yes">
                        {{ yesText || $t("Yes") }}
                    </button>
                    <button type="button" class="btn btn-secondary" @click="no">
                        {{ noText || $t("No") }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { Modal } from "bootstrap";

export default {
    props: {
        /** Style of button */
        btnStyle: {
            type: String,
            default: "btn-primary",
        },
        /** Text to use as yes */
        yesText: {
            type: String,
            default: null,
        },
        /** Text to use as no */
        noText: {
            type: String,
            default: null,
        },
        /** Title to show on modal. Defaults to translated version of "Config" */
        title: {
            type: String,
            default: null,
        },
    },
    emits: ["yes", "no"],
    data: () => ({
        modal: null,
    }),
    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },
    beforeUnmount() {
        if (this.modal) {
            this.modal.hide();
            this.modal.dispose();
        }
    },
    methods: {
        /**
         * Show the confirm dialog
         * @returns {void}
         */
        show() {
            this.modal.show();
        },
        /**
         * @fires string "yes" Notify the parent when Yes is pressed
         * @returns {void}
         */
        yes() {
            this.emitAfterHide("yes");
        },
        /**
         * @fires string "no" Notify the parent when No is pressed
         * @returns {void}
         */
        no() {
            this.emitAfterHide("no");
        },
        /**
         * Emit the action only after Bootstrap has removed the modal and backdrop.
         * @param {"yes"|"no"} eventName Event to emit
         * @returns {void}
         */
        emitAfterHide(eventName) {
            const hide = () => {
                this.$refs.modal.removeEventListener("shown.bs.modal", hide);
                this.modal.hide();
            };

            this.$refs.modal.addEventListener(
                "hidden.bs.modal",
                () => {
                    this.$emit(eventName);
                },
                { once: true }
            );

            if (this.modal._isTransitioning) {
                this.$refs.modal.addEventListener("shown.bs.modal", hide, { once: true });
            } else {
                hide();
            }
        },
    },
};
</script>
