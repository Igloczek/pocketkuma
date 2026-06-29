// @ts-nocheck

import NotificationProvider from "./notification-provider.ts";
import axios from "axios";

class Pushy extends NotificationProvider {
    name = "pushy";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = this.getAxiosConfigWithProxy({});
            await axios.post(
                `https://api.pushy.me/push?api_key=${notification.pushyAPIKey}`,
                {
                    to: notification.pushyToken,
                    data: {
                        message: "Uptime-Kuma",
                    },
                    notification: {
                        body: msg,
                        badge: 1,
                        sound: "ping.aiff",
                    },
                },
                config
            );
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default Pushy;
