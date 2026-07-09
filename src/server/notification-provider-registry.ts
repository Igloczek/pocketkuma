// @ts-nocheck
import { NOTIFICATION_PROVIDER_REGISTRY } from "@/notification-provider-metadata";

// IMPORTANT: every provider must use a static import() path.
// Template-string dynamic imports cannot be resolved by bun build --compile,
// and fail at runtime with: Cannot find module './notification-providers/....ts' from '/$bunfs/root/server.js'.
const providerLoaders = {
    apprise: () => import("@/server/notification-providers/apprise"),
    webhook: () => import("@/server/notification-providers/webhook"),
    bale: () => import("@/server/notification-providers/bale"),
    Bitrix24: () => import("@/server/notification-providers/bitrix24"),
    discord: () => import("@/server/notification-providers/discord"),
    max: () => import("@/server/notification-providers/max"),
    fluxer: () => import("@/server/notification-providers/fluxer"),
    GoogleChat: () => import("@/server/notification-providers/google-chat"),
    gorush: () => import("@/server/notification-providers/gorush"),
    gotify: () => import("@/server/notification-providers/gotify"),
    GrafanaOncall: () => import("@/server/notification-providers/grafana-oncall"),
    HaloPSA: () => import("@/server/notification-providers/HaloPSA"),
    HeiiOnCall: () => import("@/server/notification-providers/heii-oncall"),
    HomeAssistant: () => import("@/server/notification-providers/home-assistant"),
    Keep: () => import("@/server/notification-providers/keep"),
    Kook: () => import("@/server/notification-providers/kook"),
    line: () => import("@/server/notification-providers/line"),
    matrix: () => import("@/server/notification-providers/matrix"),
    mattermost: () => import("@/server/notification-providers/mattermost"),
    nextcloudtalk: () => import("@/server/notification-providers/nextcloudtalk"),
    nostr: () => import("@/server/notification-providers/nostr"),
    OneChat: () => import("@/server/notification-providers/onechat"),
    OneBot: () => import("@/server/notification-providers/onebot"),
    pumble: () => import("@/server/notification-providers/pumble"),
    "rocket.chat": () => import("@/server/notification-providers/rocket-chat"),
    signal: () => import("@/server/notification-providers/signal"),
    slack: () => import("@/server/notification-providers/slack"),
    stackfield: () => import("@/server/notification-providers/stackfield"),
    teams: () => import("@/server/notification-providers/teams"),
    telegram: () => import("@/server/notification-providers/telegram"),
    threema: () => import("@/server/notification-providers/threema"),
    ZohoCliq: () => import("@/server/notification-providers/zoho-cliq"),
    CallMeBot: () => import("@/server/notification-providers/call-me-bot"),
    whapi: () => import("@/server/notification-providers/whapi"),
    evolution: () => import("@/server/notification-providers/evolution"),
    waha: () => import("@/server/notification-providers/waha"),
    Whatsapp360messenger: () => import("@/server/notification-providers/360messenger"),
    Bark: () => import("@/server/notification-providers/bark"),
    lunasea: () => import("@/server/notification-providers/lunasea"),
    notifery: () => import("@/server/notification-providers/notifery"),
    ntfy: () => import("@/server/notification-providers/ntfy"),
    pushbullet: () => import("@/server/notification-providers/pushbullet"),
    PushByTechulus: () => import("@/server/notification-providers/techulus-push"),
    pushover: () => import("@/server/notification-providers/pushover"),
    pushy: () => import("@/server/notification-providers/pushy"),
    Webpush: () => import("@/server/notification-providers/Webpush"),
    clicksendsms: () => import("@/server/notification-providers/clicksendsms"),
    Elks: () => import("@/server/notification-providers/46elks"),
    Cellsynt: () => import("@/server/notification-providers/cellsynt"),
    gtxmessaging: () => import("@/server/notification-providers/gtx-messaging"),
    octopush: () => import("@/server/notification-providers/octopush"),
    Onesender: () => import("@/server/notification-providers/onesender"),
    SevenIO: () => import("@/server/notification-providers/sevenio"),
    SMSEagle: () => import("@/server/notification-providers/smseagle"),
    SMSPartner: () => import("@/server/notification-providers/smspartner"),
    telnyx: () => import("@/server/notification-providers/telnyx"),
    Teltonika: () => import("@/server/notification-providers/teltonika"),
    twilio: () => import("@/server/notification-providers/twilio"),
    Brevo: () => import("@/server/notification-providers/brevo"),
    Resend: () => import("@/server/notification-providers/resend"),
    SendGrid: () => import("@/server/notification-providers/send-grid"),
    smtp: () => import("@/server/notification-providers/smtp"),
    alerta: () => import("@/server/notification-providers/alerta"),
    AlertNow: () => import("@/server/notification-providers/alertnow"),
    GoAlert: () => import("@/server/notification-providers/goalert"),
    Opsgenie: () => import("@/server/notification-providers/opsgenie"),
    JiraServiceManagement: () => import("@/server/notification-providers/jira-service-management"),
    PagerDuty: () => import("@/server/notification-providers/pagerduty"),
    PagerTree: () => import("@/server/notification-providers/pagertree"),
    SIGNL4: () => import("@/server/notification-providers/signl4"),
    Splunk: () => import("@/server/notification-providers/splunk"),
    squadcast: () => import("@/server/notification-providers/squadcast"),
    GoogleSheets: () => import("@/server/notification-providers/google-sheets"),
    AliyunSMS: () => import("@/server/notification-providers/aliyun-sms"),
    egosms: () => import("@/server/notification-providers/egosms"),
    DingDing: () => import("@/server/notification-providers/dingding"),
    Feishu: () => import("@/server/notification-providers/feishu"),
    FlashDuty: () => import("@/server/notification-providers/flashduty"),
    FreeMobile: () => import("@/server/notification-providers/freemobile"),
    PushDeer: () => import("@/server/notification-providers/pushdeer"),
    promosms: () => import("@/server/notification-providers/promosms"),
    serwersms: () => import("@/server/notification-providers/serwersms"),
    SMSManager: () => import("@/server/notification-providers/smsmanager"),
    WeCom: () => import("@/server/notification-providers/wecom"),
    ServerChan: () => import("@/server/notification-providers/serverchan"),
    PushPlus: () => import("@/server/notification-providers/pushplus"),
    SpugPush: () => import("@/server/notification-providers/spugpush"),
    smsc: () => import("@/server/notification-providers/smsc"),
    smsir: () => import("@/server/notification-providers/smsir"),
    WPush: () => import("@/server/notification-providers/wpush"),
    YZJ: () => import("@/server/notification-providers/yzj"),
    SMSPlanet: () => import("@/server/notification-providers/sms-planet"),
    VK: () => import("@/server/notification-providers/vk"),
    VKTeams: () => import("@/server/notification-providers/vkteams"),
};

const OPTIONAL_NOTIFICATION_PROVIDERS = Object.keys(providerLoaders);
const loadedProviders = {};
const loadingProviders = {};

function createProviderList() {
    return Object.fromEntries(OPTIONAL_NOTIFICATION_PROVIDERS.map((name) => [name, { name }]));
}

async function getNotificationProvider(name) {
    const loader = providerLoaders[name];
    if (!loader) {
        return null;
    }

    if (loadedProviders[name]) {
        return loadedProviders[name];
    }

    if (!loadingProviders[name]) {
        loadingProviders[name] = (async () => {
            try {
                const module = await loader();
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
    NOTIFICATION_PROVIDER_REGISTRY,
    OPTIONAL_NOTIFICATION_PROVIDERS,
    createProviderList,
    getLoadedNotificationProviders,
    getNotificationProvider,
    resetLoadedNotificationProvidersForTests,
};
