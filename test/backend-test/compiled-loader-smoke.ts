import { MonitorRuntimeRegistry, OPTIONAL_MONITOR_TYPES } from "@/server/monitor-runtime-registry";
import { NotificationProviderRegistry, OPTIONAL_NOTIFICATION_PROVIDERS } from "@/server/notification-provider-registry";

const settings = { get: async () => null };
const server = { store: {}, settings, getUserAgent: () => "PocketKuma compiled loader smoke" };
const monitorRegistry = new MonitorRuntimeRegistry(server);
const notificationRegistry = new NotificationProviderRegistry(settings);

for (const name of OPTIONAL_MONITOR_TYPES) {
    if (!(await monitorRegistry.get(name))) {
        throw new Error(`Monitor factory returned no instance for ${name}`);
    }
}

for (const name of OPTIONAL_NOTIFICATION_PROVIDERS) {
    if (!(await notificationRegistry.get(name))) {
        throw new Error(`Notification provider factory returned no instance for ${name}`);
    }
}

console.log(
    JSON.stringify({
        monitors: OPTIONAL_MONITOR_TYPES.length,
        notificationProviders: OPTIONAL_NOTIFICATION_PROVIDERS.length,
    })
);
