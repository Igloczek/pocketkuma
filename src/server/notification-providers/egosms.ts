// @ts-nocheck

import NotificationProvider from "@/server/notification-providers/notification-provider";
import httpClient from "@/server/http-client";

class EgoSMS extends NotificationProvider {
    name = "egosms";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            const params = new URLSearchParams({
                number: notification.egosmsPhoneNumber,
                message: msg,
                username: notification.egosmsUsername,
                password: notification.egosmsPassword,
                sender: notification.egosmsSender || "EGOSMS",
                priority: "0",
            });

            const url = `https://www.egosms.co/api/v1/plain/?${params.toString()}`;
            let config = this.getAxiosConfigWithProxy({});
            const response = await httpClient.get(url, config);

            return response.data || okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default EgoSMS;
