// @ts-nocheck
"use strict";

const providerModules = {
    Whatsapp360messenger: "360messenger",
    Elks: "46elks",
    HaloPSA: "HaloPSA",
    Webpush: "Webpush",
    alerta: "alerta",
    AlertNow: "alertnow",
    AliyunSMS: "aliyun-sms",
    apprise: "apprise",
    bale: "bale",
    Bark: "bark",
    Bitrix24: "bitrix24",
    Brevo: "brevo",
    CallMeBot: "call-me-bot",
    Cellsynt: "cellsynt",
    clicksendsms: "clicksendsms",
    DingDing: "dingding",
    discord: "discord",
    egosms: "egosms",
    evolution: "evolution",
    Feishu: "feishu",
    FlashDuty: "flashduty",
    fluxer: "fluxer",
    FreeMobile: "freemobile",
    GoAlert: "goalert",
    GoogleChat: "google-chat",
    GoogleSheets: "google-sheets",
    gorush: "gorush",
    gotify: "gotify",
    GrafanaOncall: "grafana-oncall",
    gtxmessaging: "gtx-messaging",
    HeiiOnCall: "heii-oncall",
    HomeAssistant: "home-assistant",
    JiraServiceManagement: "jira-service-management",
    Keep: "keep",
    Kook: "kook",
    line: "line",
    lunasea: "lunasea",
    matrix: "matrix",
    mattermost: "mattermost",
    max: "max",
    nextcloudtalk: "nextcloudtalk",
    nostr: "nostr",
    notifery: "notifery",
    ntfy: "ntfy",
    octopush: "octopush",
    OneBot: "onebot",
    OneChat: "onechat",
    Onesender: "onesender",
    Opsgenie: "opsgenie",
    PagerDuty: "pagerduty",
    PagerTree: "pagertree",
    promosms: "promosms",
    pumble: "pumble",
    pushbullet: "pushbullet",
    PushDeer: "pushdeer",
    pushover: "pushover",
    PushPlus: "pushplus",
    pushy: "pushy",
    Resend: "resend",
    "rocket.chat": "rocket-chat",
    SendGrid: "send-grid",
    ServerChan: "serverchan",
    serwersms: "serwersms",
    SevenIO: "sevenio",
    signal: "signal",
    SIGNL4: "signl4",
    slack: "slack",
    SMSPlanet: "sms-planet",
    smsc: "smsc",
    SMSEagle: "smseagle",
    smsir: "smsir",
    SMSManager: "smsmanager",
    SMSPartner: "smspartner",
    smtp: "smtp",
    Splunk: "splunk",
    SpugPush: "spugpush",
    squadcast: "squadcast",
    stackfield: "stackfield",
    teams: "teams",
    PushByTechulus: "techulus-push",
    telegram: "telegram",
    telnyx: "telnyx",
    Teltonika: "teltonika",
    threema: "threema",
    twilio: "twilio",
    VK: "vk",
    VKTeams: "vkteams",
    waha: "waha",
    webhook: "webhook",
    WeCom: "wecom",
    whapi: "whapi",
    WPush: "wpush",
    YZJ: "yzj",
    ZohoCliq: "zoho-cliq",
};

const OPTIONAL_NOTIFICATION_PROVIDERS = Object.keys(providerModules);
const REMOVED_NOTIFICATION_PROVIDERS = [];
const loadedProviders = {};
const loadingProviders = {};

function createProviderList() {
    return Object.fromEntries(OPTIONAL_NOTIFICATION_PROVIDERS.map((name) => [name, { name }]));
}

async function getNotificationProvider(name) {
    const moduleName = providerModules[name];
    if (!moduleName) {
        return null;
    }

    if (loadedProviders[name]) {
        return loadedProviders[name];
    }

    if (!loadingProviders[name]) {
        loadingProviders[name] = (async () => {
            try {
                const module = await import(`./notification-providers/${moduleName}.ts`);
                const provider = new module.default();
                loadedProviders[name] = provider;
                return provider;
            } finally {
                if (!loadedProviders[name]) {
                    delete loadingProviders[name];
                }
            }
        })();
    }

    return await loadingProviders[name];
}

function getLoadedNotificationProviders() {
    return Object.keys(loadedProviders);
}

function resetLoadedNotificationProvidersForTests() {
    for (const key of Object.keys(loadedProviders)) {
        delete loadedProviders[key];
    }
    for (const key of Object.keys(loadingProviders)) {
        delete loadingProviders[key];
    }
}

export {
    OPTIONAL_NOTIFICATION_PROVIDERS,
    REMOVED_NOTIFICATION_PROVIDERS,
    createProviderList,
    getLoadedNotificationProviders,
    getNotificationProvider,
    resetLoadedNotificationProvidersForTests,
};
