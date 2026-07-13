// @ts-nocheck

import { MonitorType } from "@/server/monitor-types/monitor-type";
import { UP } from "@/util";
import nodemailer from "nodemailer";

class SMTPMonitorType extends MonitorType {
    name = "smtp";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const timeout = (monitor.timeout ?? 20) * 1000;
        const phaseTimeout = Math.max(1, timeout / 2);
        let options = {
            port: monitor.port || 25,
            host: monitor.hostname,
            secure: monitor.smtpSecurity === "secure", // use SMTPS (not STARTTLS)
            ignoreTLS: monitor.smtpSecurity === "nostarttls", // don't use STARTTLS even if it's available
            requireTLS: monitor.smtpSecurity === "starttls", // use STARTTLS or fail
            connectionTimeout: phaseTimeout,
            greetingTimeout: phaseTimeout,
            socketTimeout: phaseTimeout,
        };
        let transporter = nodemailer.createTransport(options);
        try {
            await transporter.verify();

            heartbeat.status = UP;
            heartbeat.msg = "SMTP connection verifies successfully";
        } catch (e) {
            throw new Error(`SMTP connection doesn't verify: ${e}`);
        } finally {
            transporter.close();
        }
    }
}

export { SMTPMonitorType };
