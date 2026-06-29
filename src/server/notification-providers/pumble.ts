// @ts-nocheck

import NotificationProvider from "./notification-provider.ts";
import axios from "axios";
import { UP } from "../../util.ts";

class Pumble extends NotificationProvider {
    name = "pumble";

    /**
     * @inheritDoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = this.getAxiosConfigWithProxy({});
            if (heartbeatJSON === null && monitorJSON === null) {
                let data = {
                    attachments: [
                        {
                            title: "Uptime Kuma Alert",
                            text: msg,
                            color: "#5BDD8B",
                        },
                    ],
                };

                await axios.post(notification.webhookURL, data, config);
                return okMsg;
            }

            let data = {
                attachments: [
                    {
                        title: `${monitorJSON["name"]} is ${heartbeatJSON["status"] === UP ? "up" : "down"}`,
                        text: heartbeatJSON["msg"],
                        color: heartbeatJSON["status"] === UP ? "#5BDD8B" : "#DC3645",
                    },
                ],
            };

            await axios.post(notification.webhookURL, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default Pumble;
