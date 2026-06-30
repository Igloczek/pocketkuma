// @ts-nocheck

import NotificationProvider from "@/server/notification-providers/notification-provider";
import httpClient from "@/server/http-client";

const defaultNotificationService = "notify";

class HomeAssistant extends NotificationProvider {
    name = "HomeAssistant";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        const notificationService = notification?.notificationService || defaultNotificationService;

        try {
            let config = {
                headers: {
                    Authorization: `Bearer ${notification.longLivedAccessToken}`,
                    "Content-Type": "application/json",
                },
            };
            config = this.getAxiosConfigWithProxy(config);
            await httpClient.post(
                `${notification.homeAssistantUrl.trim().replace(/\/*$/, "")}/api/services/notify/${notificationService}`,
                {
                    title: "PocketKuma",
                    message: msg,
                    ...(notificationService !== "persistent_notification" && {
                        data: {
                            name: monitorJSON?.name,
                            status: heartbeatJSON?.status,
                            channel: "PocketKuma",
                            icon_url: "https://github.com/louislam/uptime-kuma/blob/master/public/icon.png?raw=true",
                        },
                    }),
                },
                config
            );

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default HomeAssistant;
