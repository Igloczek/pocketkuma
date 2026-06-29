// @ts-nocheck

import NotificationProvider from "@/server/notification-providers/notification-provider";
import webpush from "web-push";
import { setting } from "@/server/util-server";

class Webpush extends NotificationProvider {
    name = "Webpush";

    /**
     * @inheritDoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            const publicVapidKey = await setting("webpushPublicVapidKey");
            const privateVapidKey = await setting("webpushPrivateVapidKey");

            webpush.setVapidDetails("https://github.com/louislam/uptime-kuma", publicVapidKey, privateVapidKey);

            const data = JSON.stringify({
                title: "Uptime Kuma",
                body: msg,
            });

            await webpush.sendNotification(notification.subscription, data);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default Webpush;
