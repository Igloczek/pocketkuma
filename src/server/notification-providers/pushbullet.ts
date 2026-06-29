// @ts-nocheck

import NotificationProvider from "./notification-provider.ts";
import axios from "axios";
import { DOWN, UP } from "../../util.ts";

class Pushbullet extends NotificationProvider {
    name = "pushbullet";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://api.pushbullet.com/v2/pushes";

        try {
            let config = {
                headers: {
                    "Access-Token": notification.pushbulletAccessToken,
                    "Content-Type": "application/json",
                },
            };
            config = this.getAxiosConfigWithProxy(config);
            if (heartbeatJSON == null) {
                let data = {
                    type: "note",
                    title: "Uptime Kuma Alert",
                    body: msg,
                };
                await axios.post(url, data, config);
            } else if (heartbeatJSON["status"] === DOWN) {
                let downData = {
                    type: "note",
                    title: "UptimeKuma Alert: " + monitorJSON["name"],
                    body:
                        "[🔴 Down] " +
                        heartbeatJSON["msg"] +
                        `\nTime (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`,
                };
                await axios.post(url, downData, config);
            } else if (heartbeatJSON["status"] === UP) {
                let upData = {
                    type: "note",
                    title: "UptimeKuma Alert: " + monitorJSON["name"],
                    body:
                        "[✅ Up] " +
                        heartbeatJSON["msg"] +
                        `\nTime (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`,
                };
                await axios.post(url, upData, config);
            }
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default Pushbullet;
