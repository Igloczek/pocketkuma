// @ts-nocheck

import NotificationProvider from "@/server/notification-providers/notification-provider";
import httpClient from "@/server/http-client";

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
            await httpClient.get(url.toString(), config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default CallMeBot;
