import { defineComponent, h } from "vue";

import GenericNotificationForm from "@/components/notifications/GenericNotificationForm.vue";
import {
    notificationFormSchemas,
    type NotificationFormSchema,
} from "@/components/notifications/notification-form-schemas";

export function createNotificationForm(component, props = {}) {
    return defineComponent({
        props: {
            notification: {
                type: Object,
                required: true,
            },
        },
        render() {
            return h(component, props);
        },
    });
}

export function createGenericNotificationForm(schemaId: string) {
    const schema = notificationFormSchemas[schemaId] as NotificationFormSchema | undefined;

    if (!schema) {
        throw new Error(`Unknown notification form schema: ${schemaId}`);
    }

    const form = createNotificationForm(GenericNotificationForm, { schema });
    form.name = `GenericNotificationForm_${schemaId}`;
    return form;
}
