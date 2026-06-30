import { defineAsyncComponent } from "vue";

import { createGenericNotificationForm } from "@/components/notifications/create-generic-notification-form";
import { genericNotificationFormTypes } from "@/components/notifications/notification-form-schemas";

const notificationModules = import.meta.glob(["./*.vue", "!./GenericNotificationForm.vue"]);

/**
 * Provider type string -> Vue filename (without extension).
 * Keys must match server notification provider types.
 */
const notificationComponentFiles: Record<string, string> = {
    alerta: "Alerta",
    AliyunSMS: "AliyunSms",
    apprise: "Apprise",
    bale: "Bale",
    Bark: "Bark",
    smsc: "SMSC",
    DingDing: "DingDing",
    discord: "Discord",
    fluxer: "Fluxer",
    Feishu: "Feishu",
    GoogleChat: "GoogleChat",
    GoogleSheets: "GoogleSheets",
    gorush: "Gorush",
    HomeAssistant: "HomeAssistant",
    Kook: "Kook",
    lunasea: "LunaSea",
    matrix: "Matrix",
    mattermost: "Mattermost",
    nextcloudtalk: "NextcloudTalk",
    nostr: "Nostr",
    ntfy: "Ntfy",
    octopush: "Octopush",
    OneBot: "OneBot",
    Onesender: "Onesender",
    Opsgenie: "Opsgenie",
    JiraServiceManagement: "JiraServiceManagement",
    PagerDuty: "PagerDuty",
    PagerTree: "PagerTree",
    promosms: "PromoSMS",
    pushbullet: "Pushbullet",
    PushByTechulus: "TechulusPush",
    pushover: "Pushover",
    "rocket.chat": "RocketChat",
    serwersms: "SerwerSMS",
    signal: "Signal",
    SMSManager: "SMSManager",
    SMSPartner: "SMSPartner",
    slack: "Slack",
    SMSEagle: "SMSEagle",
    teams: "Teams",
    telegram: "Telegram",
    Teltonika: "Teltonika",
    telnyx: "Telnyx",
    threema: "Threema",
    twilio: "Twilio",
    Splunk: "Splunk",
    webhook: "Webhook",
    WeCom: "WeCom",
    whapi: "Whapi",
    evolution: "Evolution",
    waha: "WAHA",
    Whatsapp360messenger: "360messenger",
    Cellsynt: "Cellsynt",
    Webpush: "Webpush",
    HaloPSA: "HaloPSA",
    max: "Max",
    VK: "VK",
    VKTeams: "VKTeams",
};

const lazyNotificationForms = Object.fromEntries(
    Object.entries(notificationComponentFiles).map(([providerType, fileName]) => {
        const path = `./${fileName}.vue`;
        const loader = notificationModules[path];

        if (!loader) {
            throw new Error(`Missing notification form module: ${path} (provider: ${providerType})`);
        }

        return [providerType, defineAsyncComponent(loader)];
    })
);

const genericNotificationForms = Object.fromEntries(
    genericNotificationFormTypes.map((schemaId) => [schemaId, createGenericNotificationForm(schemaId)])
);

/**
 * Manage all notification forms (lazy-loaded per provider, generic schema-driven forms eager).
 */
const NotificationFormList = {
    ...lazyNotificationForms,
    ...genericNotificationForms,
};

export const notificationProviderTypes = [...Object.keys(notificationComponentFiles), ...genericNotificationFormTypes];

export default NotificationFormList;
