// @ts-nocheck

import NotificationProvider from "./notification-provider.ts";
import httpClient from "../http-client.ts";

class Gorush extends NotificationProvider {
    name = "gorush";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        let platformMapping = {
            ios: 1,
            android: 2,
            huawei: 3,
        };

        try {
            let data = {
                notifications: [
                    {
                        tokens: [notification.gorushDeviceToken],
                        platform: platformMapping[notification.gorushPlatform],
                        message: msg,
                        // Optional
                        title: notification.gorushTitle,
                        priority: notification.gorushPriority,
                        retry: parseInt(notification.gorushRetry) || 0,
                        topic: notification.gorushTopic,
                    },
                ],
            };
            let config = this.getAxiosConfigWithProxy({});
            await httpClient.post(`${notification.gorushServerURL}/api/push`, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default Gorush;
