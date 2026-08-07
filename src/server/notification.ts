// @ts-nocheck

import { log } from "@/util";
import { commandExists } from "@/server/util-server";
import { createProviderList, getNotificationProvider } from "@/server/notification-provider-registry";

class Notification {
    providerList = {};

    /**
     * Initialize the notification providers
     * @returns {void}
     * @throws Notification provider does not have a name
     * @throws Duplicate notification providers in list
     */
    static init() {
        log.debug("notification", "Prepare Notification Providers");
        this.providerList = createProviderList();
    }

    /**
     * Send a notification
     * @param {BeanModel} notification Notification to send
     * @param {string} msg General Message
     * @param {object} monitorJSON Monitor details (For Up/Down only)
     * @param {object} heartbeatJSON Heartbeat details (For Up/Down only)
     * @returns {Promise<string>} Successful msg
     * @throws Error with fail msg
     */
    static async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const provider = await getNotificationProvider(notification.type);
        if (provider) {
            return provider.send(notification, msg, monitorJSON, heartbeatJSON);
        } else {
            throw new Error("Notification type is not supported");
        }
    }

    /**
     * Save a notification
     * @param {object} notification Notification to save
     * @param {?number} notificationID ID of notification to update
     * @param {number} userID ID of user who adds notification
     * @returns {Promise<Bean>} Notification that was saved
     */
    static async save(store, notification, notificationID, userID) {
        let bean;

        if (notificationID) {
            bean = await store.findOne("notification", " id = ? AND user_id = ? ", [notificationID, userID]);

            if (!bean) {
                throw new Error("notification not found");
            }
        } else {
            bean = store.dispense("notification");
        }

        // applyExisting is one time only, don't save it to database.
        const applyExisting = notification.applyExisting || false;
        notification.applyExisting = false;

        bean.name = notification.name;
        bean.user_id = userID;
        bean.config = JSON.stringify(notification);
        bean.is_default = notification.isDefault || false;
        await store.store(bean);

        if (applyExisting) {
            await applyNotificationEveryMonitor(store, bean.id, userID);
        }

        return bean;
    }

    /**
     * Delete a notification
     * @param {number} notificationID ID of notification to delete
     * @param {number} userID ID of user who created notification
     * @returns {Promise<void>}
     */
    static async delete(store, notificationID, userID) {
        let bean = await store.findOne("notification", " id = ? AND user_id = ? ", [notificationID, userID]);

        if (!bean) {
            throw new Error("notification not found");
        }

        await store.trash(bean);
    }

    /**
     * Check if apprise exists
     * @returns {Promise<boolean>} Does the command apprise exist?
     */
    static async checkApprise() {
        return await commandExists("apprise");
    }
}

/**
 * Apply the notification to every monitor
 * @param {number} notificationID ID of notification to apply
 * @param {number} userID ID of user who created notification
 * @returns {Promise<void>}
 */
async function applyNotificationEveryMonitor(store, notificationID, userID) {
    let monitors = await store.getAll("SELECT id FROM monitor WHERE user_id = ?", [userID]);

    for (let i = 0; i < monitors.length; i++) {
        let checkNotification = await store.findOne(
            "monitor_notification",
            " monitor_id = ? AND notification_id = ? ",
            [monitors[i].id, notificationID]
        );

        if (!checkNotification) {
            let relation = store.dispense("monitor_notification");
            relation.monitor_id = monitors[i].id;
            relation.notification_id = notificationID;
            await store.store(relation);
        }
    }
}

export { Notification };
