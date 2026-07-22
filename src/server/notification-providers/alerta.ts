// @ts-nocheck

import NotificationProvider from "@/server/notification-providers/notification-provider";
import { DOWN, UP } from "@/util";
import httpClient from "@/server/http-client";

class Alerta extends NotificationProvider {
    name = "alerta";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json;charset=UTF-8",
                    Authorization: "Key " + notification.alertaApiKey,
                },
            };
            let data = {
                environment: notification.alertaEnvironment,
                severity: "critical",
                correlate: [],
                service: ["PocketKuma"],
                value: "Timeout",
                tags: ["pocketkuma"],
                attributes: {},
                origin: "pocketkuma",
                type: "exceptionAlert",
            };

            config = this.getAxiosConfigWithProxy(config);

            if (heartbeatJSON == null) {
                let postData = Object.assign(
                    {
                        event: "msg",
                        text: msg,
                        group: "pocketkuma-msg",
                        resource: "Message",
                    },
                    data
                );

                await httpClient.post(notification.alertaApiEndpoint, postData, config);
            } else {
                let datadup = Object.assign(
                    {
                        correlate: ["service_up", "service_down"],
                        event: monitorJSON["type"],
                        group: "pocketkuma-" + monitorJSON["type"],
                        resource: monitorJSON["name"],
                    },
                    data
                );

                if (heartbeatJSON["status"] === DOWN) {
                    datadup.severity = notification.alertaAlertState; // critical
                    datadup.text = "Service " + monitorJSON["type"] + " is down.";
                    await httpClient.post(notification.alertaApiEndpoint, datadup, config);
                } else if (heartbeatJSON["status"] === UP) {
                    datadup.severity = notification.alertaRecoverState; // cleaned
                    datadup.text = "Service " + monitorJSON["type"] + " is up.";
                    await httpClient.post(notification.alertaApiEndpoint, datadup, config);
                }
            }
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default Alerta;
