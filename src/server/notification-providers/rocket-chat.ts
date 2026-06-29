// @ts-nocheck

import NotificationProvider from "@/server/notification-providers/notification-provider";
import httpClient from "@/server/http-client";
import Slack from "@/server/notification-providers/slack";
import { getMonitorRelativeURL, DOWN } from "@/util";
import { Settings } from "@/server/settings";

class RocketChat extends NotificationProvider {
    name = "rocket.chat";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = this.getAxiosConfigWithProxy({});
            if (heartbeatJSON == null) {
                let data = {
                    text: msg,
                    channel: notification.rocketchannel,
                    username: notification.rocketusername,
                    icon_emoji: notification.rocketiconemo,
                };
                await httpClient.post(notification.rocketwebhookURL, data, config);
                return okMsg;
            }

            let data = {
                text: "Uptime Kuma Alert",
                channel: notification.rocketchannel,
                username: notification.rocketusername,
                icon_emoji: notification.rocketiconemo,
                attachments: [
                    {
                        title: `Uptime Kuma Alert *Time (${heartbeatJSON["timezone"]})*\n${heartbeatJSON["localDateTime"]}`,
                        text: "*Message*\n" + msg,
                    },
                ],
            };

            // Color
            if (heartbeatJSON.status === DOWN) {
                data.attachments[0].color = "#ff0000";
            } else {
                data.attachments[0].color = "#32cd32";
            }

            if (notification.rocketbutton) {
                await Slack.deprecateURL(notification.rocketbutton);
            }

            const baseURL = await Settings.get("primaryBaseURL");

            if (baseURL) {
                data.attachments[0].title_link = baseURL + getMonitorRelativeURL(monitorJSON.id);
            }

            await httpClient.post(notification.rocketwebhookURL, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default RocketChat;
