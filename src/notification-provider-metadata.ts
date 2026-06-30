// @ts-nocheck

/**
 * Category order and i18n label keys for the add-notification dropdown.
 * @type {ReadonlyArray<{ id: string, labelKey: string }>}
 */
const NOTIFICATION_PROVIDER_CATEGORIES = [
    { id: "universal", labelKey: "notificationUniversal" },
    { id: "chatPlatforms", labelKey: "notificationChatPlatforms" },
    { id: "pushServices", labelKey: "notificationPushServices" },
    { id: "smsServices", labelKey: "notificationSmsServices" },
    { id: "email", labelKey: "notificationEmail" },
    { id: "incidentManagement", labelKey: "notificationIncidentManagement" },
    { id: "homeAutomation", labelKey: "notificationHomeAutomation" },
    { id: "other", labelKey: "notificationOther" },
    { id: "regional", labelKey: "notificationRegional" },
];

/**
 * Single source of truth for notification provider module paths, display labels, and categories.
 * @type {Record<string, { module: string, label?: string, labelKey?: string, categories: string[] }>}
 */
const NOTIFICATION_PROVIDER_REGISTRY = {
    apprise: { module: "apprise", labelKey: "apprise", categories: ["universal"] },
    webhook: { module: "webhook", label: "Webhook", categories: ["universal"] },

    bale: { module: "bale", label: "Bale", categories: ["chatPlatforms"] },
    Bitrix24: { module: "bitrix24", label: "Bitrix24", categories: ["chatPlatforms"] },
    discord: { module: "discord", label: "Discord", categories: ["chatPlatforms"] },
    max: { module: "max", labelKey: "maxMessenger", categories: ["chatPlatforms"] },
    fluxer: { module: "fluxer", label: "Fluxer", categories: ["chatPlatforms"] },
    GoogleChat: { module: "google-chat", label: "Google Chat (Google Workspace)", categories: ["chatPlatforms"] },
    gorush: { module: "gorush", label: "Gorush", categories: ["chatPlatforms", "pushServices"] },
    gotify: { module: "gotify", label: "Gotify", categories: ["chatPlatforms", "pushServices"] },
    GrafanaOncall: {
        module: "grafana-oncall",
        label: "Grafana Oncall",
        categories: ["chatPlatforms", "incidentManagement"],
    },
    HaloPSA: { module: "HaloPSA", label: "Halo PSA", categories: ["chatPlatforms"] },
    HeiiOnCall: {
        module: "heii-oncall",
        label: "Heii On-Call",
        categories: ["chatPlatforms", "incidentManagement"],
    },
    HomeAssistant: {
        module: "home-assistant",
        label: "Home Assistant",
        categories: ["chatPlatforms", "homeAutomation"],
    },
    Keep: { module: "keep", label: "Keep", categories: ["chatPlatforms", "incidentManagement"] },
    Kook: { module: "kook", label: "Kook", categories: ["chatPlatforms"] },
    line: { module: "line", label: "LINE Messenger", categories: ["chatPlatforms"] },
    matrix: { module: "matrix", label: "Matrix", categories: ["chatPlatforms"] },
    mattermost: { module: "mattermost", label: "Mattermost", categories: ["chatPlatforms"] },
    nextcloudtalk: { module: "nextcloudtalk", label: "Nextcloud Talk", categories: ["chatPlatforms"] },
    nostr: { module: "nostr", label: "Nostr", categories: ["chatPlatforms"] },
    OneChat: { module: "onechat", label: "OneChat", categories: ["chatPlatforms"] },
    OneBot: { module: "onebot", label: "OneBot", categories: ["chatPlatforms"] },
    pumble: { module: "pumble", label: "Pumble", categories: ["chatPlatforms"] },
    "rocket.chat": { module: "rocket-chat", label: "Rocket.Chat", categories: ["chatPlatforms"] },
    signal: { module: "signal", label: "Signal", categories: ["chatPlatforms"] },
    slack: { module: "slack", label: "Slack", categories: ["chatPlatforms"] },
    stackfield: { module: "stackfield", label: "Stackfield", categories: ["chatPlatforms"] },
    teams: { module: "teams", label: "Microsoft Teams", categories: ["chatPlatforms"] },
    telegram: { module: "telegram", label: "Telegram", categories: ["chatPlatforms"] },
    threema: { module: "threema", label: "Threema", categories: ["chatPlatforms"] },
    ZohoCliq: { module: "zoho-cliq", label: "ZohoCliq", categories: ["chatPlatforms"] },
    CallMeBot: {
        module: "call-me-bot",
        label: "CallMeBot (WhatsApp, Telegram Call, Facebook Messenger)",
        categories: ["chatPlatforms"],
    },
    whapi: { module: "whapi", label: "WhatsApp (Whapi)", categories: ["chatPlatforms"] },
    evolution: { module: "evolution", label: "WhatsApp (Evolution)", categories: ["chatPlatforms"] },
    waha: { module: "waha", label: "WhatsApp (WAHA)", categories: ["chatPlatforms"] },
    Whatsapp360messenger: { module: "360messenger", label: "WhatsApp (360messenger)", categories: ["chatPlatforms"] },

    Bark: { module: "bark", label: "Bark", categories: ["pushServices"] },
    lunasea: { module: "lunasea", label: "LunaSea", categories: ["pushServices"] },
    notifery: { module: "notifery", label: "Notifery", categories: ["pushServices"] },
    ntfy: { module: "ntfy", label: "Ntfy", categories: ["pushServices"] },
    pushbullet: { module: "pushbullet", label: "Pushbullet", categories: ["pushServices"] },
    PushByTechulus: { module: "techulus-push", label: "Push by Techulus", categories: ["pushServices"] },
    pushover: { module: "pushover", label: "Pushover", categories: ["pushServices"] },
    pushy: { module: "pushy", label: "Pushy", categories: ["pushServices"] },
    Webpush: { module: "Webpush", label: "Webpush", categories: ["pushServices"] },

    clicksendsms: { module: "clicksendsms", label: "ClickSend SMS", categories: ["smsServices"] },
    Elks: { module: "46elks", label: "46elks", categories: ["smsServices"] },
    Cellsynt: { module: "cellsynt", label: "Cellsynt", categories: ["smsServices"] },
    gtxmessaging: { module: "gtx-messaging", label: "GtxMessaging", categories: ["smsServices"] },
    octopush: { module: "octopush", label: "Octopush", categories: ["smsServices"] },
    Onesender: { module: "onesender", label: "Onesender", categories: ["smsServices"] },
    SevenIO: { module: "sevenio", label: "SevenIO", categories: ["smsServices"] },
    SMSEagle: { module: "smseagle", label: "SMSEagle", categories: ["smsServices"] },
    SMSPartner: { module: "smspartner", label: "SMS Partner", categories: ["smsServices"] },
    telnyx: { module: "telnyx", label: "Telnyx", categories: ["smsServices"] },
    Teltonika: { module: "teltonika", labelKey: "Teltonika SMS Gateway", categories: ["smsServices"] },
    twilio: { module: "twilio", label: "Twilio", categories: ["smsServices"] },

    Brevo: { module: "brevo", label: "Brevo", categories: ["email"] },
    Resend: { module: "resend", label: "Resend", categories: ["email"] },
    SendGrid: { module: "send-grid", label: "SendGrid", categories: ["email"] },
    smtp: { module: "smtp", labelKey: "smtp", categories: ["email"] },

    alerta: { module: "alerta", label: "Alerta", categories: ["incidentManagement"] },
    AlertNow: { module: "alertnow", label: "AlertNow", categories: ["incidentManagement"] },
    GoAlert: { module: "goalert", label: "GoAlert", categories: ["incidentManagement"] },
    Opsgenie: { module: "opsgenie", label: "Opsgenie", categories: ["incidentManagement"] },
    JiraServiceManagement: {
        module: "jira-service-management",
        labelKey: "Jira Service Management",
        categories: ["incidentManagement"],
    },
    PagerDuty: { module: "pagerduty", label: "PagerDuty", categories: ["incidentManagement"] },
    PagerTree: { module: "pagertree", label: "PagerTree", categories: ["incidentManagement"] },
    SIGNL4: { module: "signl4", label: "SIGNL4", categories: ["incidentManagement"] },
    Splunk: { module: "splunk", label: "Splunk", categories: ["incidentManagement"] },
    squadcast: { module: "squadcast", label: "SquadCast", categories: ["incidentManagement"] },

    GoogleSheets: { module: "google-sheets", label: "Google Sheets", categories: ["other"] },

    AliyunSMS: { module: "aliyun-sms", label: "AliyunSMS (阿里云短信服务)", categories: ["regional"] },
    egosms: { module: "egosms", label: "EgoSMS (Uganda)", categories: ["regional"] },
    DingDing: { module: "dingding", label: "DingDing (钉钉自定义机器人)", categories: ["regional"] },
    Feishu: { module: "feishu", label: "Feishu (飞书)", categories: ["regional"] },
    FlashDuty: { module: "flashduty", label: "FlashDuty (快猫星云)", categories: ["regional"] },
    FreeMobile: { module: "freemobile", label: "FreeMobile (mobile.free.fr)", categories: ["regional"] },
    PushDeer: { module: "pushdeer", label: "PushDeer", categories: ["regional"] },
    promosms: { module: "promosms", label: "PromoSMS", categories: ["regional"] },
    serwersms: { module: "serwersms", label: "SerwerSMS.pl", categories: ["regional"] },
    SMSManager: { module: "smsmanager", label: "SmsManager (smsmanager.cz)", categories: ["regional"] },
    WeCom: { module: "wecom", label: "WeCom (企业微信群机器人)", categories: ["regional"] },
    ServerChan: { module: "serverchan", label: "ServerChan (Server酱)", categories: ["regional"] },
    PushPlus: { module: "pushplus", label: "PushPlus (推送加)", categories: ["regional"] },
    SpugPush: { module: "spugpush", label: "SpugPush（Spug推送助手）", categories: ["regional"] },
    smsc: { module: "smsc", label: "SMSC", categories: ["regional"] },
    smsir: { module: "smsir", label: "SMS.IR", categories: ["regional"] },
    WPush: { module: "wpush", label: "WPush(wpush.cn)", categories: ["regional"] },
    YZJ: { module: "yzj", label: "YZJ (云之家自定义机器人)", categories: ["regional"] },
    SMSPlanet: { module: "sms-planet", label: "SMSPlanet.pl", categories: ["regional"] },
    VK: { module: "vk", label: "VK", categories: ["regional"] },
    VKTeams: { module: "vkteams", label: "VKTeams", categories: ["regional"] },
};

function getNotificationProviderModuleMap() {
    return Object.fromEntries(
        Object.entries(NOTIFICATION_PROVIDER_REGISTRY).map(([name, meta]) => [name, meta.module])
    );
}

function getNotificationProviderDisplayLabel(meta, translate) {
    if (meta.labelKey) {
        return translate(meta.labelKey);
    }
    return meta.label;
}

function sortProvidersByLabel(providers) {
    return Object.fromEntries(
        Object.entries(providers).sort(([, a], [, b]) => a.localeCompare(b))
    );
}

/**
 * Build grouped provider labels for the add-notification dropdown.
 * @param {(key: string) => string} translate
 * @returns {Record<string, Record<string, string>>}
 */
function buildNotificationNameList(translate) {
    const groups = Object.fromEntries(NOTIFICATION_PROVIDER_CATEGORIES.map((category) => [category.id, {}]));

    for (const [providerKey, meta] of Object.entries(NOTIFICATION_PROVIDER_REGISTRY)) {
        const label = getNotificationProviderDisplayLabel(meta, translate);
        for (const category of meta.categories) {
            groups[category][providerKey] = label;
        }
    }

    for (const category of NOTIFICATION_PROVIDER_CATEGORIES) {
        groups[category.id] = sortProvidersByLabel(groups[category.id]);
    }

    return groups;
}

export {
    NOTIFICATION_PROVIDER_CATEGORIES,
    NOTIFICATION_PROVIDER_REGISTRY,
    buildNotificationNameList,
    getNotificationProviderDisplayLabel,
    getNotificationProviderModuleMap,
};