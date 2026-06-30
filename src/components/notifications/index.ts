// @ts-nocheck
import Alerta from "@/components/notifications/Alerta.vue";
import AlertNow from "@/components/notifications/AlertNow.vue";
import AliyunSMS from "@/components/notifications/AliyunSms.vue";
import Apprise from "@/components/notifications/Apprise.vue";
import Bale from "@/components/notifications/Bale.vue";
import Bark from "@/components/notifications/Bark.vue";
import Bitrix24 from "@/components/notifications/Bitrix24.vue";
import Notifery from "@/components/notifications/Notifery.vue";
import ClickSendSMS from "@/components/notifications/ClickSendSMS.vue";
import CallMeBot from "@/components/notifications/CallMeBot.vue";
import SMSC from "@/components/notifications/SMSC.vue";
import DingDing from "@/components/notifications/DingDing.vue";
import Discord from "@/components/notifications/Discord.vue";
import Fluxer from "@/components/notifications/Fluxer.vue";
import Elks from "@/components/notifications/46elks.vue";
import EgoSMS from "@/components/notifications/EgoSMS.vue";
import Feishu from "@/components/notifications/Feishu.vue";
import FreeMobile from "@/components/notifications/FreeMobile.vue";
import GoogleChat from "@/components/notifications/GoogleChat.vue";
import GoogleSheets from "@/components/notifications/GoogleSheets.vue";
import Gorush from "@/components/notifications/Gorush.vue";
import Gotify from "@/components/notifications/Gotify.vue";

import GtxMessaging from "@/components/notifications/GtxMessaging.vue";
import HomeAssistant from "@/components/notifications/HomeAssistant.vue";
import HeiiOnCall from "@/components/notifications/HeiiOnCall.vue";
import { createGenericNotificationForm } from "@/components/notifications/create-generic-notification-form";
import Kook from "@/components/notifications/Kook.vue";
import Line from "@/components/notifications/Line.vue";
import LunaSea from "@/components/notifications/LunaSea.vue";
import Matrix from "@/components/notifications/Matrix.vue";
import Mattermost from "@/components/notifications/Mattermost.vue";
import NextcloudTalk from "@/components/notifications/NextcloudTalk.vue";
import Nostr from "@/components/notifications/Nostr.vue";
import Ntfy from "@/components/notifications/Ntfy.vue";
import Octopush from "@/components/notifications/Octopush.vue";
import OneChat from "@/components/notifications/OneChat.vue";
import OneBot from "@/components/notifications/OneBot.vue";
import Onesender from "@/components/notifications/Onesender.vue";
import Opsgenie from "@/components/notifications/Opsgenie.vue";
import JiraServiceManagement from "@/components/notifications/JiraServiceManagement.vue";
import PagerDuty from "@/components/notifications/PagerDuty.vue";

import PagerTree from "@/components/notifications/PagerTree.vue";
import PromoSMS from "@/components/notifications/PromoSMS.vue";

import Pushbullet from "@/components/notifications/Pushbullet.vue";

import Pushover from "@/components/notifications/Pushover.vue";

import Pushy from "@/components/notifications/Pushy.vue";
import RocketChat from "@/components/notifications/RocketChat.vue";
import ServerChan from "@/components/notifications/ServerChan.vue";
import SerwerSMS from "@/components/notifications/SerwerSMS.vue";
import Signal from "@/components/notifications/Signal.vue";
import SMSManager from "@/components/notifications/SMSManager.vue";
import SMSPartner from "@/components/notifications/SMSPartner.vue";
import Slack from "@/components/notifications/Slack.vue";

import SMSEagle from "@/components/notifications/SMSEagle.vue";

import STMP from "@/components/notifications/SMTP.vue";
import Teams from "@/components/notifications/Teams.vue";
import TechulusPush from "@/components/notifications/TechulusPush.vue";
import Telegram from "@/components/notifications/Telegram.vue";
import Teltonika from "@/components/notifications/Teltonika.vue";
import Telnyx from "@/components/notifications/Telnyx.vue";
import Threema from "@/components/notifications/Threema.vue";
import Twilio from "@/components/notifications/Twilio.vue";
import Webhook from "@/components/notifications/Webhook.vue";
import WeCom from "@/components/notifications/WeCom.vue";

import Splunk from "@/components/notifications/Splunk.vue";

import SevenIO from "@/components/notifications/SevenIO.vue";
import Whapi from "@/components/notifications/Whapi.vue";
import WAHA from "@/components/notifications/WAHA.vue";
import Whatsapp360messenger from "@/components/notifications/360messenger.vue";
import Evolution from "@/components/notifications/Evolution.vue";
import Cellsynt from "@/components/notifications/Cellsynt.vue";
import WPush from "@/components/notifications/WPush.vue";

import SendGrid from "@/components/notifications/SendGrid.vue";
import Brevo from "@/components/notifications/Brevo.vue";
import YZJ from "@/components/notifications/YZJ.vue";
import SMSPlanet from "@/components/notifications/SMSPlanet.vue";
import SMSIR from "@/components/notifications/SMSIR.vue";
import Webpush from "@/components/notifications/Webpush.vue";
import HaloPSA from "@/components/notifications/HaloPSA.vue";
import Resend from "@/components/notifications/Resend.vue";
import Max from "@/components/notifications/Max.vue";
import VK from "@/components/notifications/VK.vue";
import VKTeams from "@/components/notifications/VKTeams.vue";

/**
 * Manage all notification form.
 * @type { Record<string, any> }
 */
const NotificationFormList = {
    alerta: Alerta,
    AlertNow: AlertNow,
    AliyunSMS: AliyunSMS,
    apprise: Apprise,
    bale: Bale,
    Bark: Bark,
    Bitrix24: Bitrix24,
    clicksendsms: ClickSendSMS,
    CallMeBot: CallMeBot,
    smsc: SMSC,
    smsir: SMSIR,
    DingDing: DingDing,
    discord: Discord,
    fluxer: Fluxer,
    Elks: Elks,
    egosms: EgoSMS,
    Feishu: Feishu,
    FreeMobile: FreeMobile,
    GoogleChat: GoogleChat,
    GoogleSheets: GoogleSheets,
    gorush: Gorush,
    gotify: Gotify,
    GrafanaOncall: createGenericNotificationForm("GrafanaOncall"),
    HomeAssistant: HomeAssistant,
    HeiiOnCall: HeiiOnCall,
    Keep: createGenericNotificationForm("Keep"),
    Kook: Kook,
    line: Line,
    lunasea: LunaSea,
    matrix: Matrix,
    mattermost: Mattermost,
    nextcloudtalk: NextcloudTalk,
    nostr: Nostr,
    ntfy: Ntfy,
    octopush: Octopush,
    OneChat: OneChat,
    OneBot: OneBot,
    Onesender: Onesender,
    Opsgenie: Opsgenie,
    JiraServiceManagement: JiraServiceManagement,
    PagerDuty: PagerDuty,
    FlashDuty: createGenericNotificationForm("FlashDuty"),
    PagerTree: PagerTree,
    promosms: PromoSMS,
    pumble: createGenericNotificationForm("Pumble"),
    pushbullet: Pushbullet,
    PushByTechulus: TechulusPush,
    PushDeer: createGenericNotificationForm("PushDeer"),
    pushover: Pushover,
    PushPlus: createGenericNotificationForm("PushPlus"),
    pushy: Pushy,
    "rocket.chat": RocketChat,
    serwersms: SerwerSMS,
    signal: Signal,
    SIGNL4: createGenericNotificationForm("SIGNL4"),
    SMSManager: SMSManager,
    SMSPartner: SMSPartner,
    slack: Slack,
    squadcast: createGenericNotificationForm("Squadcast"),
    SMSEagle: SMSEagle,
    smtp: STMP,
    stackfield: createGenericNotificationForm("stackfield"),
    teams: Teams,
    telegram: Telegram,
    Teltonika: Teltonika,
    telnyx: Telnyx,
    threema: Threema,
    twilio: Twilio,
    Splunk: Splunk,
    SpugPush: createGenericNotificationForm("SpugPush"),
    webhook: Webhook,
    WeCom: WeCom,
    GoAlert: createGenericNotificationForm("GoAlert"),
    ServerChan: ServerChan,
    ZohoCliq: createGenericNotificationForm("ZohoCliq"),
    SevenIO: SevenIO,
    whapi: Whapi,
    evolution: Evolution,
    notifery: Notifery,
    waha: WAHA,
    Whatsapp360messenger: Whatsapp360messenger,
    gtxmessaging: GtxMessaging,
    Cellsynt: Cellsynt,
    WPush: WPush,
    SendGrid: SendGrid,
    Brevo: Brevo,
    Resend: Resend,
    YZJ: YZJ,
    SMSPlanet: SMSPlanet,
    Webpush: Webpush,
    HaloPSA: HaloPSA,
    max: Max,
    VK: VK,
    VKTeams: VKTeams,
};

export default NotificationFormList;
