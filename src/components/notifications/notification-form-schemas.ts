export type NotificationFieldType = "url" | "text" | "secret" | "headers" | "select";

export interface NotificationSelectOption {
    value: string;
    label: string;
}

export interface NotificationHelpLink {
    keypath: string;
    href: string;
    linkText?: string;
    linkTextKey?: string;
}

export interface NotificationFormField {
    id: string;
    key: string;
    type: NotificationFieldType;
    labelKey: string;
    placeholderKey?: string;
    placeholder?: string;
    required?: boolean;
    requiredMarker?: boolean;
    defaultValue?: string;
    options?: NotificationSelectOption[];
    helpTextKey?: string;
    helpLink?: NotificationHelpLink;
    moreInfoLink?: { href: string };
    documentationLink?: { href: string; labelKey: string; labelArgs?: string[] };
}

export interface NotificationFormSchema {
    id: string;
    fields: NotificationFormField[];
    defaults?: Record<string, string>;
}

type FieldOptions = Partial<Omit<NotificationFormField, "id" | "key" | "type" | "labelKey">>;

function urlField(id: string, key: string, labelKey: string, options: FieldOptions = {}): NotificationFormField {
    return { id, key, type: "url", labelKey, required: true, ...options };
}

function textField(id: string, key: string, labelKey: string, options: FieldOptions = {}): NotificationFormField {
    return { id, key, type: "text", labelKey, required: true, ...options };
}

function secretField(id: string, key: string, labelKey: string, options: FieldOptions = {}): NotificationFormField {
    return { id, key, type: "secret", labelKey, required: true, ...options };
}

function selectField(
    id: string,
    key: string,
    labelKey: string,
    fieldOptions: NotificationSelectOption[],
    options: FieldOptions = {}
): NotificationFormField {
    return { id, key, type: "select", labelKey, required: true, options: fieldOptions, ...options };
}

function schema(
    id: string,
    fields: NotificationFormField[],
    defaults?: Record<string, string>
): NotificationFormSchema {
    return defaults ? { id, fields, defaults } : { id, fields };
}

const flashDutySeverityOptions = [
    { value: "Info", label: "Info" },
    { value: "Warning", label: "Warning" },
    { value: "Critical", label: "Critical" },
];

export const notificationFormSchemas: Record<string, NotificationFormSchema> = {
    Keep: schema(
        "Keep",
        [
            urlField("keep-host-url", "webhookURL", "Host URL", {
                helpLink: {
                    keypath: "Read more:",
                    href: "https://docs.keephq.dev/providers/documentation/uptimekuma-provider",
                },
            }),
            secretField("keep-api-key", "webhookAPIKey", "API Key"),
        ],
        { webhookURL: "" }
    ),
    Squadcast: schema("Squadcast", [urlField("squadcast-webhook-url", "squadcastWebhookURL", "Post URL")]),
    SIGNL4: schema("SIGNL4", [
        urlField("signl4-webhook-url", "webhookURL", "SIGNL4 Webhook URL", {
            helpLink: {
                keypath: "signl4Docs",
                href: "https://docs.signl4.com/integrations/uptime-kuma/uptime-kuma.html",
                linkText: "SIGNL4 Docs",
            },
        }),
    ]),
    Pumble: schema("Pumble", [
        urlField("pumble-webhook-url", "webhookURL", "Webhook URL", {
            requiredMarker: true,
            documentationLink: {
                href: "https://pumble.com/help/integrations/add-pumble-apps/incoming-webhooks-for-pumble/",
                labelKey: "documentationOf",
                labelArgs: ["Pumble Webbhook"],
            },
        }),
    ]),
    stackfield: schema("stackfield", [
        textField("stackfield-webhook-url", "stackfieldwebhookURL", "Webhook URL", {
            requiredMarker: true,
            helpTextKey: "Required",
            helpLink: {
                keypath: "aboutWebhooks",
                href: "https://www.stackfield.com/developer-api#AnchorAPI2",
            },
        }),
    ]),
    GoAlert: schema("GoAlert", [
        textField("goalert-base-url", "goAlertBaseURL", "Base URL", {
            helpLink: { keypath: "goAlertInfo", href: "https://goalert.me", linkText: "https://goalert.me" },
        }),
        secretField("goalert-token", "goAlertToken", "Token", { helpTextKey: "goAlertIntegrationKeyInfo" }),
    ]),
    PushPlus: schema("PushPlus", [
        secretField("pushplus-sendkey", "pushPlusSendKey", "SendKey", {
            moreInfoLink: { href: "https://www.pushplus.plus/" },
        }),
    ]),
    SpugPush: schema("SpugPush", [
        secretField("spugpush-template-key", "templateKey", "SpugPush Template Code", {
            moreInfoLink: { href: "https://push.spug.cc/guide/plugin/kuma" },
        }),
    ]),
    FlashDuty: schema("FlashDuty", [
        secretField("flashduty-integration-url", "flashdutyIntegrationKey", "FlashDuty Push URL", {
            placeholderKey: "FlashDuty Push URL Placeholder",
            requiredMarker: true,
            helpTextKey: "Required",
            helpLink: {
                keypath: "wayToGetFlashDutyKey",
                href: "https://flashcat.cloud/product/flashduty?from=kuma",
                linkTextKey: "here",
            },
        }),
        selectField("flashduty-severity", "flashdutySeverity", "FlashDuty Severity", flashDutySeverityOptions, {
            defaultValue: "Info",
        }),
    ]),
    GrafanaOncall: schema("GrafanaOncall", [
        textField("grafana-oncall-url", "GrafanaOncallURL", "GrafanaOncallURL", { requiredMarker: true }),
    ]),
    ZohoCliq: schema("ZohoCliq", [
        textField("zcliq-webhookurl", "webhookUrl", "Webhook URL", {
            helpLink: {
                keypath: "wayToGetZohoCliqURL",
                href: "https://www.zoho.com/cliq/help/platform/webhook-tokens.html",
                linkTextKey: "here",
            },
        }),
    ]),
    PushDeer: schema("PushDeer", [
        textField("pushdeer-server", "pushdeerServer", "PushDeer Server URL", {
            required: false,
            placeholder: "https://api2.pushdeer.com",
            helpTextKey: "pushDeerServerDescription",
        }),
        secretField("pushdeer-key", "pushdeerKey", "PushDeer Key", {
            placeholder: "PDUxxxx",
            moreInfoLink: { href: "http://www.pushdeer.com/" },
        }),
    ]),
};

export const genericNotificationFormTypes = Object.keys(notificationFormSchemas);
