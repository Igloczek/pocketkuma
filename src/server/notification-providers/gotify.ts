// @ts-nocheck
const NotificationProvider = require("./notification-provider");
const httpClient = require("../http-client");

class Gotify extends NotificationProvider {
    name = "gotify";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = this.getAxiosConfigWithProxy({});
            if (notification.gotifyserverurl && notification.gotifyserverurl.endsWith("/")) {
                notification.gotifyserverurl = notification.gotifyserverurl.slice(0, -1);
            }
            await httpClient.post(
                `${notification.gotifyserverurl}/message?token=${notification.gotifyapplicationToken}`,
                {
                    message: msg,
                    priority: notification.gotifyPriority || 8,
                    title: "Uptime-Kuma",
                },
                config
            );

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Gotify;
