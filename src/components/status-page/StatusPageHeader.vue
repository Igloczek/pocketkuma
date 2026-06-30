<template>
    <div>
        <h1 class="mb-4 title-flex">
            <span class="logo-wrapper" @click="$emit('show-image-upload')">
                <button
                    v-if="editMode"
                    type="button"
                    class="p-0 bg-transparent border-0 small-reset-btn reset-top-left"
                    @click.stop="$emit('reset-image')"
                >
                    <font-awesome-icon icon="times" class="text-danger" />
                </button>
                <img :src="logoURL" alt class="logo me-2" :class="logoClass" />
                <font-awesome-icon v-if="enableEditMode" class="icon-upload" icon="upload" />
            </span>

            <ImageCropUpload
                :model-value="showImageCropUpload"
                field="img"
                :width="128"
                :height="128"
                :langType="$i18n.locale"
                img-format="png"
                :noCircle="true"
                :noSquare="false"
                @update:model-value="$emit('update:showImageCropUpload', $event)"
                @crop-success="$emit('crop-success', $event)"
            />

            <Editable
                :model-value="title"
                tag="span"
                :contenteditable="editMode"
                :noNL="true"
                @update:model-value="$emit('update:title', $event)"
            />
        </h1>

        <div v-if="hasToken" class="mb-2">
            <div v-if="!enableEditMode">
                <button class="btn btn-primary mb-2 me-2" data-testid="edit-button" @click="$emit('edit')">
                    <font-awesome-icon icon="edit" />
                    {{ $t("Edit Status Page") }}
                </button>

                <a href="/manage-status-page" class="btn btn-primary mb-2">
                    <font-awesome-icon icon="tachometer-alt" />
                    {{ $t("Go to Dashboard") }}
                </a>
            </div>

            <div v-else>
                <button
                    class="btn btn-primary btn-add-group me-2"
                    data-testid="create-incident-button"
                    @click="$emit('create-incident')"
                >
                    <font-awesome-icon icon="bullhorn" />
                    {{ $t("Create Incident") }}
                </button>
            </div>
        </div>
    </div>
</template>

<script>
import ImageCropUpload from "vue-image-crop-upload";

export default {
    components: {
        ImageCropUpload,
    },

    props: {
        title: {
            type: String,
            default: "",
        },
        logoURL: {
            type: String,
            required: true,
        },
        logoClass: {
            type: Object,
            default: () => ({}),
        },
        enableEditMode: {
            type: Boolean,
            default: false,
        },
        editMode: {
            type: Boolean,
            default: false,
        },
        hasToken: {
            type: Boolean,
            default: false,
        },
        showImageCropUpload: {
            type: Boolean,
            default: false,
        },
    },

    emits: [
        "update:title",
        "update:showImageCropUpload",
        "edit",
        "create-incident",
        "show-image-upload",
        "reset-image",
        "crop-success",
    ],
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

h1 {
    font-size: 30px;

    img {
        vertical-align: middle;
        height: 60px;
        width: 60px;
    }
}

.title-flex {
    display: flex;
    align-items: center;
    gap: 10px;
}

.logo-wrapper {
    display: inline-block;
    position: relative;

    &:hover {
        .icon-upload {
            transform: scale(1.2);
        }
    }

    .icon-upload {
        transition: all $easing-in 0.2s;
        position: absolute;
        bottom: 6px;
        font-size: 20px;
        left: -14px;
        background-color: white;
        padding: 5px;
        border-radius: 10px;
        cursor: pointer;
        box-shadow: 0 15px 70px rgba(0, 0, 0, 0.9);
    }

    .reset-top-left {
        transition:
            transform $easing-in 0.18s,
            box-shadow $easing-in 0.18s,
            background-color $easing-in 0.18s;
        font-size: 18px;
        width: 18px;
        height: 18px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: white;
        border: none;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        transform-origin: center;

        &:hover {
            background-color: rgba(0, 0, 0, 0.06);
            transform: scale(1.18);
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
        }

        &:hover ~ .icon-upload {
            transform: none !important;
        }
    }

    .small-reset-btn {
        transition:
            transform $easing-in 0.18s,
            box-shadow $easing-in 0.18s,
            background-color $easing-in 0.18s;
        font-size: 18px;
        width: 18px;
        height: 18px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: transparent;
        border: none;
        cursor: pointer;

        &:hover {
            background-color: rgba(0, 0, 0, 0.04);
            transform: scale(1.18);
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
        }
    }
}

.logo {
    transition: all $easing-in 0.2s;

    &.edit-mode {
        cursor: pointer;

        &:hover {
            transform: scale(1.2);
        }
    }
}

.mobile {
    h1 {
        font-size: 22px;
    }
}
</style>
