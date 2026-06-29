// @ts-nocheck

import NotificationProvider from "./notification-provider.ts";
import { runCommand } from "../process-helper.ts";

class Apprise extends NotificationProvider {
    name = "apprise";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        const args = ["-vv", "-b", msg, notification.appriseURL];
        if (notification.title) {
            args.push("-t");
            args.push(notification.title);
        }
        const s = await runCommand("apprise", args);

        const output = s.stdout || "ERROR: maybe apprise not found";

        if (output) {
            if (!output.includes("ERROR")) {
                return okMsg;
            }

            throw new Error(output);
        } else {
            return "No output from apprise";
        }
    }
}

export default Apprise;
