// @ts-nocheck

import NotificationProvider from "@/server/notification-providers/notification-provider";
import httpClient from "@/server/http-client";

class FreeMobile extends NotificationProvider {
    name = "FreeMobile";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = this.getAxiosConfigWithProxy({});
            await httpClient.post(
                `https://smsapi.free-mobile.fr/sendmsg?msg=${encodeURIComponent(msg.replace("🔴", "⛔️"))}`,
                {
                    user: notification.freemobileUser,
                    pass: notification.freemobilePass,
                },
                config
            );

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default FreeMobile;
