// @ts-nocheck

import NotificationProvider from "@/server/notification-providers/notification-provider";
import httpClient from "@/server/http-client";

class Telnyx extends NotificationProvider {
    name = "telnyx";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let data = {
                from: notification.telnyxPhoneNumber,
                to: notification.telnyxToNumber,
                text: msg,
            };

            if (notification.telnyxMessagingProfileId) {
                data.messaging_profile_id = notification.telnyxMessagingProfileId;
            }

            let config = {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + notification.telnyxApiKey,
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            await httpClient.post("https://api.telnyx.com/v2/messages", data, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default Telnyx;
