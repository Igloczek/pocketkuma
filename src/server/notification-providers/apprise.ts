// @ts-nocheck
const NotificationProvider = require("./notification-provider");
const { runCommand } = require("../process-helper");

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

module.exports = Apprise;
