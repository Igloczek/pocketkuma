import { getMonitorType, OPTIONAL_MONITOR_TYPES } from "@/server/monitor-runtime-registry";
import { getNotificationProvider, OPTIONAL_NOTIFICATION_PROVIDERS } from "@/server/notification-provider-registry";

const server = { getUserAgent: () => "PocketKuma compiled loader smoke" };

for (const name of OPTIONAL_MONITOR_TYPES) {
    if (!(await getMonitorType(name, server))) {
        throw new Error(`Monitor factory returned no instance for ${name}`);
    }
}

for (const name of OPTIONAL_NOTIFICATION_PROVIDERS) {
    if (!(await getNotificationProvider(name))) {
        throw new Error(`Notification provider factory returned no instance for ${name}`);
    }
}

console.log(
    JSON.stringify({
        monitors: OPTIONAL_MONITOR_TYPES.length,
        notificationProviders: OPTIONAL_NOTIFICATION_PROVIDERS.length,
    })
);
