// @ts-nocheck

import NotificationProvider from "./notification-provider.ts";
import axios from "axios";
import { UP } from "../../util.ts";

class Bitrix24 extends NotificationProvider {
    name = "Bitrix24";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            const params = {
                user_id: notification.bitrix24UserID,
                message: "[B]Uptime Kuma[/B]",
                "ATTACH[COLOR]": (heartbeatJSON ?? {})["status"] === UP ? "#b73419" : "#67b518",
                "ATTACH[BLOCKS][0][MESSAGE]": msg,
            };

            let config = this.getAxiosConfigWithProxy({ params });
            await axios.get(`${notification.bitrix24WebhookURL}/im.notify.system.add.json`, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default Bitrix24;
