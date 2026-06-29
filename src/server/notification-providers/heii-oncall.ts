// @ts-nocheck

import { UP, DOWN, getMonitorRelativeURL } from "@/util";
import { setting } from "@/server/util-server";
import NotificationProvider from "@/server/notification-providers/notification-provider";
import httpClient from "@/server/http-client";

class HeiiOnCall extends NotificationProvider {
    name = "HeiiOnCall";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const payload = heartbeatJSON || {};

        const baseURL = await setting("primaryBaseURL");
        if (baseURL && monitorJSON) {
            payload["url"] = baseURL + getMonitorRelativeURL(monitorJSON.id);
        }

        let config = {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: "Bearer " + notification.heiiOnCallApiKey,
            },
        };
        const heiiUrl = `https://heiioncall.com/triggers/${notification.heiiOnCallTriggerId}/`;
        // docs https://heiioncall.com/docs#manual-triggers
        try {
            config = this.getAxiosConfigWithProxy(config);
            if (!heartbeatJSON) {
                // Testing or general notification like certificate expiry
                payload["msg"] = msg;
                await httpClient.post(heiiUrl + "alert", payload, config);
                return okMsg;
            }

            if (heartbeatJSON.status === DOWN) {
                await httpClient.post(heiiUrl + "alert", payload, config);
                return okMsg;
            }
            if (heartbeatJSON.status === UP) {
                await httpClient.post(heiiUrl + "resolve", payload, config);
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default HeiiOnCall;
