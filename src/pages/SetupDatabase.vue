<template>
    <div v-if="show" class="form-container">
        <form @submit.prevent="submit">
            <div>
                <object width="64" height="64" data="/icon.svg" />
                <div style="font-size: 28px; font-weight: bold; margin-top: 5px">uptime-buna</div>
            </div>

            <div v-if="info.runningSetup" class="mt-5">
                <div class="alert alert-success mx-3 px-4" role="alert">
                    <div class="d-flex align-items-center">
                        <strong>{{ $t("settingUpDatabaseMSG") }}</strong>
                        <div class="ms-3 pt-1">
                            <div class="spinner-border" role="status" aria-hidden="true"></div>
                        </div>
                    </div>
                </div>
            </div>

            <template v-if="!info.runningSetup">
                <div class="form-floating short mt-3">
                    <select id="language" v-model="$root.language" class="form-select">
                        <option v-for="(lang, i) in $i18n.availableLocales" :key="`Lang${i}`" :value="lang">
                            {{ $i18n.messages[lang].languageName }}
                        </option>
                    </select>
                    <label for="language" class="form-label">{{ $t("Language") }}</label>
                </div>

                <p class="mt-5 short">
                    {{ $t("setupDatabaseSQLite") }}
                </p>

                <button class="btn btn-primary mt-4 short" type="submit" :disabled="disabledButton">
                    {{ $t("Next") }}
                </button>
            </template>
        </form>
    </div>
</template>

<script>
import axios from "axios";
import { useToast } from "vue-toastification";
import { sleep } from "../util.ts";
const toast = useToast();

export default {
    data() {
        return {
            show: false,
            dbConfig: {
                type: "sqlite",
            },
            info: {
                needSetup: false,
                runningSetup: false,
            },
        };
    },
    computed: {
        disabledButton() {
            return this.info.runningSetup;
        },
    },
    async mounted() {
        let res = await axios.get("/setup-database-info");
        this.info = res.data;

        if (this.info && this.info.needSetup === false) {
            location.href = "/setup";
        } else {
            this.show = true;
        }
    },
    methods: {
        async submit() {
            this.info.runningSetup = true;

            try {
                await axios.post("/setup-database", {
                    dbConfig: this.dbConfig,
                });
                await sleep(2000);
                await this.goToMainServerWhenReady();
            } catch (e) {
                toast.error(e.response.data);
            } finally {
                this.info.runningSetup = false;
            }
        },

        async goToMainServerWhenReady() {
            try {
                console.log("Trying...");
                let res = await axios.get("/setup-database-info");
                if (res.data && res.data.needSetup === false) {
                    this.show = false;
                    location.href = "/setup";
                } else {
                    if (res.data) {
                        this.info = res.data;
                    }
                    throw new Error("not ready");
                }
            } catch (e) {
                console.log("Not ready yet");
                await sleep(2000);
                await this.goToMainServerWhenReady();
            }
        },
    },
};
</script>

<style lang="scss" scoped>
.form-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-top: 40px;
    padding-bottom: 40px;
}

.form-floating {
    > .form-select {
        padding-left: 1.3rem;
        padding-top: 1.525rem;
        line-height: 1.35;

        ~ label {
            padding-left: 1.3rem;
        }
    }

    > label {
        padding-left: 1.3rem;
    }
}

.short {
    width: 300px;
}

form {
    max-width: 800px;
    text-align: center;
    display: flex;
    justify-content: center;
    flex-direction: column;
    align-items: center;
}
</style>
