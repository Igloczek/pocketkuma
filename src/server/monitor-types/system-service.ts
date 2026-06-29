// @ts-nocheck

import { MonitorType } from "./monitor-type.ts";
import process from "process";
import { UP } from "../../util.ts";
import { runCommand } from "../process-helper.ts";

class SystemServiceMonitorType extends MonitorType {
    name = "system-service";
    description = "Checks if a system service is running (systemd on Linux, Service Manager on Windows).";

    /**
     * Check the system service status.
     * Detects OS and dispatches to the appropriate check method.
     * @param {object} monitor The monitor object containing monitor.system_service_name.
     * @param {object} heartbeat The heartbeat object to update.
     * @returns {Promise<void>} Resolves when check is complete.
     */
    async check(monitor, heartbeat) {
        if (!monitor.system_service_name) {
            throw new Error("Service Name is required.");
        }

        if (process.platform === "win32") {
            return this.checkWindows(monitor.system_service_name, heartbeat);
        } else if (process.platform === "linux") {
            return this.checkLinux(monitor.system_service_name, heartbeat);
        } else {
            throw new Error(`System Service monitoring is not supported on ${process.platform}`);
        }
    }

    /**
     * Linux Check (Systemd)
     * @param {string} serviceName The name of the service to check.
     * @param {object} heartbeat The heartbeat object.
     * @returns {Promise<void>}
     */
    async checkLinux(serviceName, heartbeat) {
        // SECURITY: Prevent Argument Injection
        // Only allow alphanumeric, dots, dashes, underscores, and @
        if (!serviceName || !/^[a-zA-Z0-9._\-@]+$/.test(serviceName)) {
            throw new Error("Invalid service name. Please use the internal Service Name (no spaces).");
        }

        const result = await runCommand("systemctl", ["is-active", serviceName], { timeout: 5000 });
        let output = trimOutput(result.stderr || result.stdout);

        if (result.code !== 0) {
            throw new Error(output || `Service '${serviceName}' is not running.`);
        }

        heartbeat.status = UP;
        heartbeat.msg = `Service '${serviceName}' is running.`;
    }

    /**
     * Windows Check (PowerShell)
     * @param {string} serviceName The name of the service to check.
     * @param {object} heartbeat The heartbeat object.
     * @returns {Promise<void>} Resolves on success, rejects on error.
     */
    async checkWindows(serviceName, heartbeat) {
        // SECURITY: Validate service name to reduce command-injection risk
        if (!/^[A-Za-z0-9._-]+$/.test(serviceName)) {
            throw new Error("Invalid service name. Only alphanumeric characters and '.', '_', '-' are allowed.");
        }

        const result = await runCommand(
            "powershell",
            [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                `(Get-Service -Name '${serviceName.replaceAll("'", "''")}').Status`,
            ],
            { timeout: 5000 }
        );
        let output = trimOutput(result.stderr || result.stdout);

        if (result.code !== 0 || result.stderr) {
            throw new Error(`Service '${serviceName}' is not running/found.`);
        }

        if (output === "Running") {
            heartbeat.status = UP;
            heartbeat.msg = `Service '${serviceName}' is running.`;
        } else {
            throw new Error(`Service '${serviceName}' is ${output}.`);
        }
    }
}

function trimOutput(output) {
    output = (output || "").trim();
    if (output.length > 200) {
        output = output.substring(0, 200) + "...";
    }
    return output;
}

export { SystemServiceMonitorType };
