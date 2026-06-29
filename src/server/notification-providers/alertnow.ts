// @ts-nocheck

import NotificationProvider from "@/server/notification-providers/notification-provider";
import httpClient from "@/server/http-client";
import { getMonitorRelativeURL, UP, DOWN } from "@/util";
import { Settings } from "@/server/settings";

class AlertNow extends NotificationProvider {
    name = "AlertNow";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let textMsg = "";
            let status = "open";
            let eventType = "ERROR";
            let eventId = new Date().toISOString().slice(0, 10).replace(/-/g, "");

            if (heartbeatJSON && heartbeatJSON.status === UP) {
                textMsg = `[${heartbeatJSON.name}] ✅ Application is back online`;
                status = "close";
                eventType = "INFO";
                eventId += `_${heartbeatJSON.name.replace(/\s/g, "")}`;
            } else if (heartbeatJSON && heartbeatJSON.status === DOWN) {
                textMsg = `[${heartbeatJSON.name}] 🔴 Application went down`;
            }

            textMsg += ` - ${msg}`;

            const baseURL = await Settings.get("primaryBaseURL");
            if (baseURL && monitorJSON) {
                textMsg += ` >> ${baseURL + getMonitorRelativeURL(monitorJSON.id)}`;
            }

            const data = {
                summary: textMsg,
                status: status,
                event_type: eventType,
                event_id: eventId,
            };

            let config = this.getAxiosConfigWithProxy({});

            await httpClient.post(notification.alertNowWebhookURL, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default AlertNow;
