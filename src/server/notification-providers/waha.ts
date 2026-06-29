// @ts-nocheck

import NotificationProvider from "@/server/notification-providers/notification-provider";
import httpClient from "@/server/http-client";

class WAHA extends NotificationProvider {
    name = "waha";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "X-Api-Key": notification.wahaApiKey,
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            let data = {
                session: notification.wahaSession,
                chatId: notification.wahaChatId,
                text: msg,
            };

            let url = notification.wahaApiUrl.replace(/([^/])\/+$/, "$1") + "/api/sendText";

            await httpClient.post(url, data, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default WAHA;
