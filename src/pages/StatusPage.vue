<template>
    <div v-if="loadedTheme" class="container mt-3">
        <StatusPageEditSidebar
            v-if="enableEditMode"
            :config="config"
            :editable-config-ready="editableConfigReady"
            :loading="loading"
            @add-domain="addDomainField"
            @remove-domain="removeDomain"
            @delete="deleteDialog"
            @save="save"
            @discard="discard"
        />

        <!-- Main Status Page -->
        <div :class="{ edit: enableEditMode }" class="main">
            <StatusPageHeader
                v-model:title="config.title"
                v-model:show-image-crop-upload="showImageCropUpload"
                :logo-u-r-l="logoURL"
                :logo-class="logoClass"
                :enable-edit-mode="enableEditMode"
                :edit-mode="editMode"
                :has-token="hasToken"
                @edit="edit"
                @create-incident="createIncident"
                @show-image-upload="showImageCropUploadMethod"
                @reset-image="resetToDefaultImage"
                @crop-success="cropSuccess"
            />

            <IncidentEditForm
                v-if="
                    editIncidentMode &&
                    incident !== null &&
                    (!incident.id || !activeIncidents.some((i) => i.id === incident.id))
                "
                v-model="incident"
                @post="postIncident"
                @cancel="cancelIncident"
            />

            <StatusPageActiveIncidents
                v-model:incident="incident"
                :active-incidents="activeIncidents"
                :edit-incident-mode="editIncidentMode"
                :edit-mode="editMode"
                @post-incident="postIncident"
                @cancel-incident="cancelIncident"
                @resolve-incident="resolveIncident"
                @edit-incident="editIncident"
                @delete-incident="$refs.incidentManageModal.showDelete($event)"
            />

            <StatusPageOverallStatus :loaded-data="loadedData" />

            <StatusPageMaintenanceBanner :maintenance-list="maintenanceList" />

            <StatusPageMonitorGroups
                v-model:description="config.description"
                v-model:selected-monitor="selectedMonitor"
                :loaded-data="loadedData"
                :enable-edit-mode="enableEditMode"
                :edit-mode="editMode"
                :show-tags="config.showTags"
                :show-certificate-expiry="config.showCertificateExpiry"
                :show-only-last-heartbeat="config.showOnlyLastHeartbeat"
                :sorted-monitor-list="sortedMonitorList"
                @add-group="addGroup"
            />

            <StatusPagePastIncidents
                :past-incident-count="pastIncidentCount"
                :grouped-incident-history="groupedIncidentHistory"
                :enable-edit-mode="enableEditMode"
                :incident-history-loading="incidentHistoryLoading"
                :incident-history-has-more="incidentHistoryHasMore"
                @load-more="loadMoreIncidentHistory"
                @edit-incident="$refs.incidentManageModal.showEdit($event)"
                @delete-incident="$refs.incidentManageModal.showDelete($event)"
                @resolve-incident="resolveIncident"
            />

            <IncidentManageModal
                v-if="enableEditMode"
                ref="incidentManageModal"
                :slug="slug"
                @incident-updated="loadIncidentHistory"
            />

            <StatusPageFooter
                v-model:footer-text="config.footerText"
                :enable-edit-mode="enableEditMode"
                :show-powered-by="config.showPoweredBy"
                :last-update-time-display="lastUpdateTimeDisplay"
                :update-countdown-text="updateCountdownText"
            />
        </div>

        <Confirm
            ref="confirmDelete"
            btn-style="btn-danger"
            :yes-text="$t('Yes')"
            :no-text="$t('No')"
            @yes="deleteStatusPage"
        >
            {{ $t("deleteStatusPageMsg") }}
        </Confirm>

        <StatusPageCustomStyles :custom-c-s-s="config.customCSS" />
    </div>
</template>

<script>
import { fetchDevApi } from "@/util/dev-api-base";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { updateFaviconBadge } from "@/util/favicon-badge";
import { useToast } from "vue-toastification";
import Confirm from "@/components/Confirm.vue";
import IncidentManageModal from "@/components/IncidentManageModal.vue";
import IncidentEditForm from "@/components/IncidentEditForm.vue";
import StatusPageHeader from "@/components/status-page/StatusPageHeader.vue";
import StatusPageFooter from "@/components/status-page/StatusPageFooter.vue";
import StatusPageMaintenanceBanner from "@/components/status-page/StatusPageMaintenanceBanner.vue";
import StatusPageCustomStyles from "@/components/status-page/StatusPageCustomStyles.vue";
import StatusPageActiveIncidents from "@/components/status-page/StatusPageActiveIncidents.vue";
import StatusPagePastIncidents from "@/components/status-page/StatusPagePastIncidents.vue";
import StatusPageMonitorGroups from "@/components/status-page/StatusPageMonitorGroups.vue";
import StatusPageOverallStatus from "@/components/status-page/StatusPageOverallStatus.vue";
import StatusPageEditSidebar from "@/components/status-page/StatusPageEditSidebar.vue";
import { getResBaseURL } from "@/util-frontend";

const toast = useToast();
dayjs.extend(duration);

const leavePageMsg = "Do you really want to leave? you have unsaved changes!";

// eslint-disable-next-line no-unused-vars
let feedInterval;

export default {
    components: {
        Confirm,
        IncidentManageModal,
        IncidentEditForm,
        StatusPageHeader,
        StatusPageFooter,
        StatusPageMaintenanceBanner,
        StatusPageCustomStyles,
        StatusPageActiveIncidents,
        StatusPagePastIncidents,
        StatusPageMonitorGroups,
        StatusPageOverallStatus,
        StatusPageEditSidebar,
    },

    // Leave Page for vue route change
    beforeRouteLeave(to, from, next) {
        if (this.editMode) {
            const answer = window.confirm(leavePageMsg);
            if (answer) {
                next();
            } else {
                next(false);
            }
        }
        next();
    },

    props: {
        /** Override for the status page slug */
        overrideSlug: {
            type: String,
            required: false,
            default: null,
        },
    },

    data() {
        return {
            slug: null,
            enableEditMode: false,
            enableEditIncidentMode: false,
            hasToken: false,
            config: {
                analyticsType: null,
            },
            selectedMonitor: null,
            incident: null,
            previousIncident: null,
            showImageCropUpload: false,
            imgDataUrl: "/icon.svg",
            loadedTheme: false,
            loadedData: false,
            baseURL: "",
            clickedEditButton: false,
            editableConfigReady: false,
            maintenanceList: [],
            lastUpdateTime: dayjs(),
            updateCountdown: null,
            updateCountdownText: null,
            loading: true,
            incidentHistory: [],
            incidentHistoryLoading: false,
            incidentHistoryNextCursor: null,
            incidentHistoryHasMore: false,
        };
    },
    computed: {
        logoURL() {
            if (this.imgDataUrl.startsWith("data:")) {
                return this.imgDataUrl;
            } else {
                return this.baseURL + this.imgDataUrl;
            }
        },

        /**
         * If the monitor is added to public list, which will not be in this list.
         * @returns {object[]} List of monitors
         */
        sortedMonitorList() {
            let result = [];

            for (let id in this.$root.monitorList) {
                if (this.$root.monitorList[id] && !(id in this.$root.publicMonitorList)) {
                    let monitor = this.$root.monitorList[id];
                    result.push(monitor);
                }
            }

            result.sort((m1, m2) => {
                if (m1.active !== m2.active) {
                    if (m1.active === 0) {
                        return 1;
                    }

                    if (m2.active === 0) {
                        return -1;
                    }
                }

                if (m1.weight !== m2.weight) {
                    if (m1.weight > m2.weight) {
                        return -1;
                    }

                    if (m1.weight < m2.weight) {
                        return 1;
                    }
                }

                return m1.pathName.localeCompare(m2.pathName);
            });

            return result;
        },

        editMode() {
            return this.enableEditMode && this.$root.socket.connected;
        },

        editIncidentMode() {
            return this.enableEditIncidentMode;
        },

        isPublished() {
            return this.config.published;
        },

        logoClass() {
            if (this.editMode) {
                return {
                    "edit-mode": true,
                };
            }
            return {};
        },

        lastUpdateTimeDisplay() {
            return this.$root.datetime(this.lastUpdateTime);
        },

        /**
         * Get all active pinned incidents for display at the top
         * @returns {object[]} List of active pinned incidents
         */
        activeIncidents() {
            return this.incidentHistory.filter((i) => i.active && i.pin);
        },

        /**
         * Count of past incidents (non-active or unpinned)
         * @returns {number} Number of past incidents
         */
        pastIncidentCount() {
            return this.incidentHistory.filter((i) => !(i.active && i.pin)).length;
        },

        /**
         * Group past incidents (non-active or unpinned) by date for display
         * Active+pinned incidents are shown separately at the top, not in this section
         * @returns {object} Incidents grouped by date string
         */
        groupedIncidentHistory() {
            const groups = {};
            const pastIncidents = this.incidentHistory.filter((i) => !(i.active && i.pin));
            for (const incident of pastIncidents) {
                const dateKey = this.formatDateKey(incident.createdDate);
                if (!groups[dateKey]) {
                    groups[dateKey] = [];
                }
                groups[dateKey].push(incident);
            }
            return groups;
        },
    },
    watch: {
        /**
         * If connected to the socket and logged in, request private data of this statusPage
         * @param {boolean} loggedIn Is the client logged in?
         * @returns {void}
         */
        "$root.loggedIn"(loggedIn) {
            if (loggedIn && this.enableEditMode && !this.editableConfigReady) {
                this.loadEditableConfig();
            }
        },

        /**
         * Selected a monitor and add to the list.
         * @param {object} monitor Monitor to add
         * @returns {void}
         */
        selectedMonitor(monitor) {
            if (monitor) {
                if (this.$root.publicGroupList.length === 0) {
                    this.addGroup();
                }

                const firstGroup = this.$root.publicGroupList[0];

                firstGroup.monitorList.push(monitor);
                this.selectedMonitor = null;
            }
        },

        // Set Theme
        "config.theme"() {
            this.$root.statusPageTheme = this.config.theme;
            this.loadedTheme = true;
        },

        "config.title"(title) {
            document.title = title;
        },

        "$root.monitorList"() {
            let count = Object.keys(this.$root.monitorList).length;

            // Since publicGroupList is getting from public rest api, monitors' tags may not present if showTags = false
            if (count > 0) {
                for (let group of this.$root.publicGroupList) {
                    for (let monitor of group.monitorList) {
                        if (monitor.tags === undefined && this.$root.monitorList[monitor.id]) {
                            monitor.tags = this.$root.monitorList[monitor.id].tags;
                        }
                    }
                }
            }
        },
    },
    async created() {
        this.hasToken = "token" in this.$root.storage();

        // Browser change page
        // https://stackoverflow.com/questions/7317273/warn-user-before-leaving-web-page-with-unsaved-changes
        window.addEventListener("beforeunload", (e) => {
            if (this.editMode) {
                (e || window.event).returnValue = leavePageMsg;
                return leavePageMsg;
            } else {
                return null;
            }
        });

        // Special handle for dev
        this.baseURL = getResBaseURL();
    },
    async mounted() {
        this.slug = this.overrideSlug || this.$route.params.slug;

        if (!this.slug) {
            this.slug = "default";
        }

        this.getData()
            .then((res) => {
                this.config = res.data.config;

                if (!this.config.domainNameList) {
                    this.config.domainNameList = [];
                }

                if (this.config.icon) {
                    this.imgDataUrl = this.config.icon;
                }

                this.maintenanceList = res.data.maintenanceList;
                this.$root.publicGroupList = res.data.publicGroupList;

                this.incident = res.data.incident;
                this.loading = false;

                feedInterval = setInterval(
                    () => {
                        this.updateHeartbeatList();
                    },
                    Math.max(5, this.config.autoRefreshInterval) * 1000
                );

                this.updateUpdateTimer();
            })
            .catch(function (error) {
                if (error.response.status === 404) {
                    location.href = "/page-not-found";
                }
                console.log(error);
            });

        this.updateHeartbeatList();
        this.loadIncidentHistory();

        // Go to edit page if ?edit present
        // null means ?edit present, but no value
        if (this.$route.query.edit || this.$route.query.edit === null) {
            this.edit();
        }
    },
    methods: {
        /**
         * Get status page data
         * It should be preloaded in window.preloadData
         * @returns {Promise<any>} Status page data
         */
        getData: function () {
            if (window.preloadData) {
                return new Promise((resolve) =>
                    resolve({
                        data: window.preloadData,
                    })
                );
            } else {
                return fetchDevApi("/api/status-page/" + this.slug).then(async (res) => ({
                    data: await res.json(),
                }));
            }
        },

        /**
         * Update the heartbeat list and update favicon if necessary
         * @returns {void}
         */
        updateHeartbeatList() {
            // If editMode, it will use the data from websocket.
            if (!this.editMode) {
                fetchDevApi("/api/status-page/heartbeat/" + this.slug)
                    .then((res) => res.json())
                    .then((data) => {
                        const { heartbeatList, uptimeList } = data;

                        this.$root.heartbeatList = heartbeatList;
                        this.$root.uptimeList = uptimeList;

                        const heartbeatIds = Object.keys(heartbeatList);
                        const downMonitors = heartbeatIds.reduce((downMonitorsAmount, currentId) => {
                            const monitorHeartbeats = heartbeatList[currentId];
                            const lastHeartbeat = monitorHeartbeats.at(-1);

                            if (lastHeartbeat) {
                                return lastHeartbeat.status === 0 ? downMonitorsAmount + 1 : downMonitorsAmount;
                            } else {
                                return downMonitorsAmount;
                            }
                        }, 0);

                        updateFaviconBadge(downMonitors);

                        this.loadedData = true;
                        this.lastUpdateTime = dayjs();
                        this.updateUpdateTimer();
                    });
            }
        },

        /**
         * Setup timer to display countdown to refresh
         * @returns {void}
         */
        updateUpdateTimer() {
            clearInterval(this.updateCountdown);

            this.updateCountdown = setInterval(() => {
                // rounding here as otherwise we sometimes skip numbers in cases of time drift
                const countdown = dayjs.duration(
                    Math.round(
                        this.lastUpdateTime.add(Math.max(5, this.config.autoRefreshInterval), "seconds").diff(dayjs()) /
                            1000
                    ),
                    "seconds"
                );

                if (countdown.as("seconds") < 0) {
                    clearInterval(this.updateCountdown);
                } else {
                    this.updateCountdownText = countdown.format("mm:ss");
                }
            }, 1000);
        },

        /**
         * Enable editing mode
         * @returns {void}
         */
        async edit() {
            if (this.hasToken) {
                this.editableConfigReady = false;
                this.$root.initSocketIO(true);
                this.clickedEditButton = true;

                // Try to fix #1658
                this.loadedData = true;

                try {
                    await this.loadEditableConfig();
                    this.enableEditMode = true;
                } catch (error) {
                    this.$root.toastError(error.message);
                }
            }
        },

        /**
         * Wait until the status-page socket is authenticated.
         * @returns {Promise<void>}
         */
        waitForSocketLogin() {
            if (this.$root.loggedIn) {
                return Promise.resolve();
            }

            return new Promise((resolve, reject) => {
                const started = Date.now();
                const check = () => {
                    if (this.$root.loggedIn) {
                        resolve();
                    } else if (Date.now() - started > 5000) {
                        reject(new Error("Timed out while loading status page editor."));
                    } else {
                        setTimeout(check, 50);
                    }
                };

                check();
            });
        },

        /**
         * Load the private status page config before exposing edit controls.
         * @returns {Promise<void>}
         */
        async loadEditableConfig() {
            await this.waitForSocketLogin();

            return new Promise((resolve, reject) => {
                this.$root.getSocket().emit("getStatusPage", this.slug, (res) => {
                    if (res.ok) {
                        this.config = res.config;

                        if (!this.config.customCSS) {
                            this.config.customCSS = "body {\n" + "  \n" + "}\n";
                        }

                        this.editableConfigReady = true;
                        resolve();
                    } else {
                        reject(new Error(res.msg));
                    }
                });
            });
        },

        /**
         * Save the status page
         * @returns {void}
         */
        save() {
            this.loading = true;
            let startTime = new Date();
            this.config.slug = this.config.slug.trim().toLowerCase();

            this.$root
                .getSocket()
                .emit("saveStatusPage", this.slug, this.config, this.imgDataUrl, this.$root.publicGroupList, (res) => {
                    if (res.ok) {
                        this.enableEditMode = false;
                        this.$root.publicGroupList = res.publicGroupList;

                        // Add some delay, so that the side menu animation would be better
                        let endTime = new Date();
                        let time = 100 - (endTime - startTime) / 1000;

                        if (time < 0) {
                            time = 0;
                        }

                        setTimeout(() => {
                            this.loading = false;
                            const targetPath = "/status/" + this.config.slug;
                            if (location.pathname === targetPath && !location.search) {
                                location.reload();
                            } else {
                                location.href = targetPath;
                            }
                        }, time);
                    } else {
                        this.loading = false;
                        toast.error(res.msg);
                    }
                });
        },

        /**
         * Show dialog confirming deletion
         * @returns {void}
         */
        deleteDialog() {
            this.$refs.confirmDelete.show();
        },

        /**
         * Request deletion of this status page
         * @returns {void}
         */
        deleteStatusPage() {
            this.$root.getSocket().emit("deleteStatusPage", this.slug, (res) => {
                if (res.ok) {
                    this.enableEditMode = false;
                    location.href = "/manage-status-page";
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },

        /**
         * Returns label for a specified monitor
         * @param {object} monitor Object representing monitor
         * @returns {string} Monitor label
         */
        monitorSelectorLabel(monitor) {
            return `${monitor.name}`;
        },

        /**
         * Add a group to the status page
         * @returns {void}
         */
        addGroup() {
            let groupName = this.$t("Untitled Group");

            if (this.$root.publicGroupList.length === 0) {
                groupName = this.$t("Services");
            }

            this.$root.publicGroupList.unshift({
                name: groupName,
                monitorList: [],
            });
        },

        /**
         * Add a domain to the status page
         * @returns {void}
         */
        addDomainField() {
            this.config.domainNameList.push("");
        },

        /**
         * Discard changes to status page
         * @returns {void}
         */
        discard() {
            location.href = "/status/" + this.slug;
        },

        /**
         * Set URL of new image after successful crop operation
         * @param {string} imgDataUrl URL of image in data:// format
         * @returns {void}
         */
        cropSuccess(imgDataUrl) {
            this.imgDataUrl = imgDataUrl;
        },

        /**
         * Show image crop dialog if in edit mode
         * @returns {void}
         */
        showImageCropUploadMethod() {
            if (this.editMode) {
                this.showImageCropUpload = true;
            }
        },

        /**
         * Reset logo image to default (public/icon.svg)
         * @returns {void}
         */
        resetToDefaultImage() {
            if (!this.editMode) {
                return;
            }

            this.imgDataUrl = "/icon.svg";
            this.config.icon = this.imgDataUrl;
            toast.success(this.$t("imageResetConfirmation"));
        },

        /**
         * Create an incident for this status page
         * @returns {void}
         */
        createIncident() {
            this.enableEditIncidentMode = true;

            if (this.incident) {
                this.previousIncident = this.incident;
            }

            this.incident = {
                title: "",
                content: "",
                style: "primary",
            };
        },

        /**
         * Post the incident to the status page
         * @returns {void}
         */
        postIncident() {
            if (this.incident.title === "" || this.incident.content === "") {
                this.$root.toastError("Please input title and content");
                return;
            }

            this.$root.getSocket().emit("postIncident", this.slug, this.incident, (res) => {
                if (res.ok) {
                    this.enableEditIncidentMode = false;
                    this.incident = null;
                    this.loadIncidentHistory();
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },

        /**
         * Edit an incident inline
         * @param {object} incident - The incident to edit
         * @returns {void}
         */
        editIncident(incident) {
            this.previousIncident = this.incident;
            this.incident = { ...incident };
            this.enableEditIncidentMode = true;
        },

        /**
         * Cancel creation or editing of incident
         * @returns {void}
         */
        cancelIncident() {
            this.enableEditIncidentMode = false;

            if (this.previousIncident) {
                this.incident = this.previousIncident;
                this.previousIncident = null;
            }
        },

        /**
         * Unpin the incident
         * @returns {void}
         */
        unpinIncident() {
            this.$root.getSocket().emit("unpinIncident", this.slug, () => {
                this.incident = null;
            });
        },

        /**
         * Remove a domain from the status page
         * @param {number} index Index of domain to remove
         * @returns {void}
         */
        removeDomain(index) {
            this.config.domainNameList.splice(index, 1);
        },

        /**
         * Load incident history for the status page
         * @returns {void}
         */
        loadIncidentHistory() {
            this.loadIncidentHistoryWithCursor(null);
        },

        /**
         * Load incident history using cursor-based pagination
         * @param {string|null} cursor - Cursor for pagination (created_date of last item)
         * @param {boolean} append - Whether to append to existing list
         * @returns {void}
         */
        loadIncidentHistoryWithCursor(cursor, append = false) {
            this.incidentHistoryLoading = true;

            if (this.enableEditMode) {
                this.$root.getSocket().emit("getIncidentHistory", this.slug, cursor, (res) => {
                    this.incidentHistoryLoading = false;
                    if (res.ok) {
                        if (append) {
                            this.incidentHistory = [...this.incidentHistory, ...res.incidents];
                        } else {
                            this.incidentHistory = res.incidents;
                        }
                        this.incidentHistoryNextCursor = res.nextCursor;
                        this.incidentHistoryHasMore = res.hasMore;
                    } else {
                        console.error("Failed to load incident history:", res.msg);
                        this.$root.toastError(res.msg);
                    }
                });
            } else {
                const url = cursor
                    ? `/api/status-page/${this.slug}/incident-history?cursor=${encodeURIComponent(cursor)}`
                    : `/api/status-page/${this.slug}/incident-history`;
                fetchDevApi(url)
                    .then((res) => res.json())
                    .then((data) => {
                        this.incidentHistoryLoading = false;
                        if (data.ok) {
                            if (append) {
                                this.incidentHistory = [...this.incidentHistory, ...data.incidents];
                            } else {
                                this.incidentHistory = data.incidents;
                            }
                            this.incidentHistoryNextCursor = data.nextCursor;
                            this.incidentHistoryHasMore = data.hasMore;
                        }
                    })
                    .catch((error) => {
                        this.incidentHistoryLoading = false;
                        console.error("Failed to load incident history:", error);
                    });
            }
        },

        /**
         * Load more incident history using cursor-based pagination
         * @returns {void}
         */
        loadMoreIncidentHistory() {
            if (this.incidentHistoryHasMore && this.incidentHistoryNextCursor) {
                this.loadIncidentHistoryWithCursor(this.incidentHistoryNextCursor, true);
            }
        },

        /**
         * Format date key for grouping (e.g., "December 8, 2025")
         * @param {string} dateStr - ISO date string
         * @returns {string} Formatted date key
         */
        formatDateKey(dateStr) {
            if (!dateStr) {
                return this.$t("Unknown");
            }
            const date = new Date(dateStr);
            return date.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
            });
        },

        /**
         * Resolve an incident
         * @param {object} incident - The incident to resolve
         * @returns {void}
         */
        resolveIncident(incident) {
            this.$root.getSocket().emit("resolveIncident", this.slug, incident.id, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.loadIncidentHistory();
                }
            });
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.main {
    transition: all ease-in-out 0.1s;

    &.edit {
        margin-left: 300px;
    }
}

.maintenance-bg-info {
    color: $maintenance;
}

.maintenance-icon {
    font-size: 35px;
    vertical-align: middle;
}

.dark .shadow-box {
    background-color: #0d1117;
}
</style>
