// @ts-nocheck

import NotificationProvider from "./notification-provider.ts";
import axios from "axios";

class Bale extends NotificationProvider {
    name = "bale";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://tapi.bale.ai";

        try {
            await axios.post(
                `${url}/bot${notification.baleBotToken}/sendMessage`,
                {
                    chat_id: notification.baleChatID,
                    text: msg,
                },
                {
                    headers: {
                        "content-type": "application/json",
                    },
                }
            );
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default Bale;
