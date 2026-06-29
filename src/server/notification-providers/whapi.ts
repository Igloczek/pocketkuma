// @ts-nocheck

import NotificationProvider from "@/server/notification-providers/notification-provider";
import httpClient from "@/server/http-client";

class Whapi extends NotificationProvider {
    name = "whapi";

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
                    Authorization: "Bearer " + notification.whapiAuthToken,
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            let data = {
                to: notification.whapiRecipient,
                body: msg,
            };

            let url =
                (notification.whapiApiUrl || "https://gate.whapi.cloud/").replace(/([^/])\/+$/, "$1") +
                "/messages/text";

            await httpClient.post(url, data, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default Whapi;
