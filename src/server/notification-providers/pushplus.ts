// @ts-nocheck

import NotificationProvider from "./notification-provider.ts";
import axios from "axios";
import { DOWN, UP } from "../../util.ts";

class PushPlus extends NotificationProvider {
    name = "PushPlus";

    /**
     * @inheritdoc
     * @param {BeanModel} notification Notification object
     * @param {string} msg Message content
     * @param {?object} monitorJSON Monitor details
     * @param {?object} heartbeatJSON Heartbeat details
     * @returns {Promise<string>} Success message
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://www.pushplus.plus/send";
        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                },
            };
            config = this.getAxiosConfigWithProxy(config);
            const params = {
                token: notification.pushPlusSendKey,
                title: this.checkStatus(heartbeatJSON, monitorJSON),
                content: msg,
                template: "html",
            };
            await axios.post(url, params, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Get the formatted title for message
     * @param {?object} heartbeatJSON Heartbeat details (For Up/Down only)
     * @param {?object} monitorJSON Monitor details (For Up/Down only)
     * @returns {string} Formatted title
     */
    checkStatus(heartbeatJSON, monitorJSON) {
        let title = "UptimeKuma Message";
        if (heartbeatJSON != null && heartbeatJSON["status"] === UP) {
            title = "UptimeKuma Monitor Up " + monitorJSON["name"];
        }
        if (heartbeatJSON != null && heartbeatJSON["status"] === DOWN) {
            title = "UptimeKuma Monitor Down " + monitorJSON["name"];
        }
        return title;
    }
}

export default PushPlus;
