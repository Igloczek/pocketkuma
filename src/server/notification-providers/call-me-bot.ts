// @ts-nocheck

import NotificationProvider from "./notification-provider.ts";
import axios from "axios";

class CallMeBot extends NotificationProvider {
    name = "CallMeBot";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        try {
            const url = new URL(notification.callMeBotEndpoint);
            url.searchParams.set("text", msg);
            let config = this.getAxiosConfigWithProxy({});
            await axios.get(url.toString(), config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default CallMeBot;
