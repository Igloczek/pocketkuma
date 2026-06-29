// @ts-nocheck

import NotificationProvider from "@/server/notification-providers/notification-provider";
import httpClient from "@/server/http-client";

class Kook extends NotificationProvider {
    name = "Kook";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://www.kookapp.cn/api/v3/message/create";

        let data = {
            target_id: notification.kookGuildID,
            content: msg,
        };
        let config = {
            headers: {
                Authorization: "Bot " + notification.kookBotToken,
                "Content-Type": "application/json",
            },
        };
        try {
            config = this.getAxiosConfigWithProxy(config);
            await httpClient.post(url, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default Kook;
