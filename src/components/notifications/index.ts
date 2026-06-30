import { defineAsyncComponent } from "vue";

import { createGenericNotificationForm } from "@/components/notifications/create-generic-notification-form";

const notificationModules = import.meta.glob("./*.vue");

/** Providers using schema-driven generic form (no dedicated .vue file). */
const genericNotificationProviders: Record<string, string> = {
    GrafanaOncall: "GrafanaOncall",
    Keep: "Keep",
    FlashDuty: "FlashDuty",
    pumble: "Pumble",
    PushDeer: "PushDeer",
    PushPlus: "PushPlus",
    SIGNL4: "SIGNL4",
    squadcast: "Squadcast",
    stackfield: "stackfield",
    SpugPush: "SpugPush",
    GoAlert: "GoAlert",
    ZohoCliq: "ZohoCliq",
};

/**
 * Provider type string -> Vue filename (without extension).
 * Keys must match server notification provider types.
 */
const notificationComponentFiles: Record<string, string> = {
    alerta: "Alerta",
    AlertNow: "AlertNow",
    AliyunSMS: "AliyunSms",
    apprise: "Apprise",
    bale: "Bale",
    Bark: "Bark",
    Bitrix24: "Bitrix24",
    clicksendsms: "ClickSendSMS",
    CallMeBot: "CallMeBot",
    smsc: "SMSC",
    smsir: "SMSIR",
    DingDing: "DingDing",
    discord: "Discord",
    fluxer: "Fluxer",
    Elks: "46elks",
    egosms: "EgoSMS",
    Feishu: "Feishu",
    FreeMobile: "FreeMobile",
    GoogleChat: "GoogleChat",
    GoogleSheets: "GoogleSheets",
    gorush: "Gorush",
    gotify: "Gotify",
    HomeAssistant: "HomeAssistant",
    HeiiOnCall: "HeiiOnCall",
    Kook: "Kook",
    line: "Line",
    lunasea: "LunaSea",
    matrix: "Matrix",
    mattermost: "Mattermost",
    nextcloudtalk: "NextcloudTalk",
    nostr: "Nostr",
    ntfy: "Ntfy",
    octopush: "Octopush",
    OneChat: "OneChat",
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
    pushy: "Pushy",
    "rocket.chat": "RocketChat",
    serwersms: "SerwerSMS",
    signal: "Signal",
    SMSManager: "SMSManager",
    SMSPartner: "SMSPartner",
    slack: "Slack",
    SMSEagle: "SMSEagle",
    smtp: "SMTP",
    teams: "Teams",
    telegram: "Telegram",
    Teltonika: "Teltonika",
    telnyx: "Telnyx",
    threema: "Threema",
    twilio: "Twilio",
    Splunk: "Splunk",
    webhook: "Webhook",
    WeCom: "WeCom",
    ServerChan: "ServerChan",
    SevenIO: "SevenIO",
    whapi: "Whapi",
    evolution: "Evolution",
    notifery: "Notifery",
    waha: "WAHA",
    Whatsapp360messenger: "360messenger",
    gtxmessaging: "GtxMessaging",
    Cellsynt: "Cellsynt",
    WPush: "WPush",
    SendGrid: "SendGrid",
    Brevo: "Brevo",
    Resend: "Resend",
    YZJ: "YZJ",
    SMSPlanet: "SMSPlanet",
    Webpush: "Webpush",
    HaloPSA: "HaloPSA",
    max: "Max",
    VK: "VK",
    VKTeams: "VKTeams",
};

const lazyLoadedEntries = Object.entries(notificationComponentFiles).map(([providerType, fileName]) => {
    const path = `./${fileName}.vue`;
    const loader = notificationModules[path];

    if (!loader) {
        throw new Error(`Missing notification form module: ${path} (provider: ${providerType})`);
    }

    return [providerType, defineAsyncComponent(loader)];
});

const genericEntries = Object.entries(genericNotificationProviders).map(([providerType, schemaId]) => {
    return [providerType, createGenericNotificationForm(schemaId)];
});

/**
 * Manage all notification forms (lazy-loaded per provider, generic schema forms inline).
 */
const NotificationFormList = Object.fromEntries([...lazyLoadedEntries, ...genericEntries]);

export const notificationProviderTypes = [
    ...Object.keys(notificationComponentFiles),
    ...Object.keys(genericNotificationProviders),
];

export default NotificationFormList;
