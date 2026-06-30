import { defineComponent, h } from "vue";

import GenericNotificationForm from "@/components/notifications/GenericNotificationForm.vue";
import {
    notificationFormSchemas,
    type NotificationFormSchema,
} from "@/components/notifications/notification-form-schemas";

export function createGenericNotificationForm(schemaId: string) {
    const schema = notificationFormSchemas[schemaId] as NotificationFormSchema | undefined;

    if (!schema) {
        throw new Error(`Unknown notification form schema: ${schemaId}`);
    }

    return defineComponent({
        name: `GenericNotificationForm_${schemaId}`,
        render() {
            return h(GenericNotificationForm, { schema });
        },
    });
}
