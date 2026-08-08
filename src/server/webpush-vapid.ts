import { log } from "@/server/logger";

interface WebpushSettings {
    get(key: string): Promise<unknown>;
    set(key: string, value: string): Promise<unknown>;
}

interface WebpushModule {
    default: {
        generateVAPIDKeys(): { publicKey: string; privateKey: string };
    };
}

type WebpushLoader = () => Promise<WebpushModule>;

const pendingKeys = new WeakMap<WebpushSettings, Promise<string>>();

export async function getWebpushVapidPublicKey(
    settings: WebpushSettings,
    loadWebpush: WebpushLoader = () => import("web-push") as unknown as Promise<WebpushModule>
): Promise<string> {
    const publicVapidKey = (await settings.get("webpushPublicVapidKey")) as string | null | undefined;

    if (publicVapidKey) {
        return publicVapidKey;
    }

    let generation = pendingKeys.get(settings);
    if (!generation) {
        generation = (async () => {
            log.debug("webpush", "Generating new VAPID keys");
            const { default: webpush } = await loadWebpush();
            const vapidKeys = webpush.generateVAPIDKeys();

            await settings.set("webpushPublicVapidKey", vapidKeys.publicKey);
            await settings.set("webpushPrivateVapidKey", vapidKeys.privateKey);

            return vapidKeys.publicKey;
        })();
        pendingKeys.set(settings, generation);
        void generation.then(
            () => pendingKeys.delete(settings),
            () => pendingKeys.delete(settings)
        );
    }

    return generation;
}
