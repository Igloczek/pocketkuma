// @ts-nocheck

import NotificationProvider from "./notification-provider.ts";
import axios from "axios";
import { DOWN, UP } from "../../util.ts";

class SpugPush extends NotificationProvider {
    name = "SpugPush";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            let formData = {
                title: "Uptime Kuma Message",
                content: msg,
            };
            if (heartbeatJSON) {
                if (heartbeatJSON["status"] === UP) {
                    formData.title = `UptimeKuma 「${monitorJSON["name"]}」 is Up`;
                    formData.content = `[✅ Up] ${heartbeatJSON["msg"]}`;
                } else if (heartbeatJSON["status"] === DOWN) {
                    formData.title = `UptimeKuma 「${monitorJSON["name"]}」 is Down`;
                    formData.content = `[🔴 Down] ${heartbeatJSON["msg"]}`;
                }
            }
            const apiUrl = `https://push.spug.cc/send/${notification.templateKey}`;
            let config = this.getAxiosConfigWithProxy({});
            await axios.post(apiUrl, formData, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default SpugPush;
