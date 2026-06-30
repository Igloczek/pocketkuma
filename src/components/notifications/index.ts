import { defineAsyncComponent } from "vue";

const notificationModules = import.meta.glob("./*.vue");

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
    GrafanaOncall: "GrafanaOncall",
    HomeAssistant: "HomeAssistant",
    HeiiOnCall: "HeiiOnCall",
    Keep: "Keep",
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
    FlashDuty: "FlashDuty",
    PagerTree: "PagerTree",
    promosms: "PromoSMS",
    pumble: "Pumble",
    pushbullet: "Pushbullet",
    PushByTechulus: "TechulusPush",
    PushDeer: "PushDeer",
    pushover: "Pushover",
    PushPlus: "PushPlus",
    pushy: "Pushy",
    "rocket.chat": "RocketChat",
    serwersms: "SerwerSMS",
    signal: "Signal",
    SIGNL4: "SIGNL4",
    SMSManager: "SMSManager",
    SMSPartner: "SMSPartner",
    slack: "Slack",
    squadcast: "Squadcast",
    SMSEagle: "SMSEagle",
    smtp: "SMTP",
    stackfield: "Stackfield",
    teams: "Teams",
    telegram: "Telegram",
    Teltonika: "Teltonika",
    telnyx: "Telnyx",
    threema: "Threema",
    twilio: "Twilio",
    Splunk: "Splunk",
    SpugPush: "SpugPush",
    webhook: "Webhook",
    WeCom: "WeCom",
    GoAlert: "GoAlert",
    ServerChan: "ServerChan",
    ZohoCliq: "ZohoCliq",
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

/**
 * Manage all notification forms (lazy-loaded per provider).
 */
const NotificationFormList = Object.fromEntries(
    Object.entries(notificationComponentFiles).map(([providerType, fileName]) => {
        const path = `./${fileName}.vue`;
        const loader = notificationModules[path];

        if (!loader) {
            throw new Error(`Missing notification form module: ${path} (provider: ${providerType})`);
        }

        return [providerType, defineAsyncComponent(loader)];
    })
);

export const notificationProviderTypes = Object.keys(notificationComponentFiles);

export default NotificationFormList;