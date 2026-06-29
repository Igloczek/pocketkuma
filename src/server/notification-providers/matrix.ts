// @ts-nocheck

import NotificationProvider from "./notification-provider.ts";
import axios from "axios";
import Crypto from "crypto";
import { log } from "../../util.ts";

class Matrix extends NotificationProvider {
    name = "matrix";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        const size = 20;
        const randomString = encodeURIComponent(Crypto.randomBytes(size).toString("base64").slice(0, size));

        log.debug("notification", "Random String: " + randomString);

        const roomId = encodeURIComponent(notification.internalRoomId);

        log.debug("notification", "Matrix Room ID: " + roomId);

        try {
            let config = {
                headers: {
                    Authorization: `Bearer ${notification.accessToken}`,
                },
            };
            let data = {
                msgtype: "m.text",
                body: msg,
            };

            if (notification.matrixUseTemplate) {
                data.body = await this.renderTemplate(notification.matrixTemplate, msg, monitorJSON, heartbeatJSON);
            }

            config = this.getAxiosConfigWithProxy(config);
            await axios.put(
                `${notification.homeserverUrl}/_matrix/client/r0/rooms/${roomId}/send/m.room.message/${randomString}`,
                data,
                config
            );
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

export default Matrix;
