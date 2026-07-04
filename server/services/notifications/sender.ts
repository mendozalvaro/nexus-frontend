import {
  getActiveTemplate,
  getNotificationPreferences,
  logNotification,
  sendWhatsAppMessage,
  updateNotificationStatus,
} from "./whatsapp";

type NotificationType = "sale_receipt" | "appointment_confirmation" | "appointment_reminder" | "appointment_status_change";

interface NotificationSendInput {
  notificationType: NotificationType;
  recipientPhone: string;
  recipientName?: string;
  templateVariables: Record<string, string>;
}

interface NotificationSendResult {
  success: boolean;
  reason?: string;
  message?: string;
  notificationId?: string | null;
  whatsappMessageId?: string;
  status?: string;
}

const normalizeRecipientPhone = (rawPhone: string): string => {
  const trimmed = rawPhone.trim();
  const digitsOnly = trimmed.replace(/[^\d]/g, "");
  const normalized = digitsOnly.startsWith("00") ? digitsOnly.slice(2) : digitsOnly;

  if (normalized.length < 8 || normalized.length > 15) {
    throw createError({
      statusCode: 400,
      statusMessage: "Telefono invalido para WhatsApp. Usa formato internacional, por ejemplo 59160195006.",
    });
  }

  return normalized;
};

export const sendNotificationWithPreferences = async (
  adminClient: any,
  organizationId: string,
  input: NotificationSendInput,
): Promise<NotificationSendResult> => {
  const recipientPhone = normalizeRecipientPhone(input.recipientPhone);
  const prefs = await getNotificationPreferences(adminClient, organizationId);

  if (!prefs?.whatsapp_enabled) {
    return {
      success: false,
      reason: "whatsapp_disabled",
      message: "WhatsApp no está habilitado para esta organización",
    };
  }

  const typeEnabledMap: Record<NotificationType, boolean> = {
    sale_receipt: prefs.send_sale_receipt,
    appointment_confirmation: prefs.send_appointment_confirmation,
    appointment_reminder: prefs.send_appointment_reminder,
    appointment_status_change: prefs.send_appointment_status_change,
  };

  if (!typeEnabledMap[input.notificationType]) {
    return {
      success: false,
      reason: "notification_type_disabled",
      message: `Notificación ${input.notificationType} deshabilitada`,
    };
  }

  if (!prefs.whatsapp_phone_id || !prefs.whatsapp_access_token) {
    return {
      success: false,
      reason: "credentials_missing",
      message: "Credenciales de WhatsApp no configuradas",
    };
  }

  const template = await getActiveTemplate(adminClient, organizationId, input.notificationType);
  if (!template) {
    return {
      success: false,
      reason: "template_not_found",
      message: `Template ${input.notificationType} no encontrado`,
    };
  }

  const notificationId = await logNotification(adminClient, {
    organization_id: organizationId,
    notification_type: input.notificationType,
    channel: "whatsapp",
    recipient_phone: recipientPhone,
    recipient_name: input.recipientName,
    template_id: template.id,
    payload: input.templateVariables,
    status: "pending",
  });

  try {
    let result;
    try {
      const templateOrder = Array.isArray(template.variables) ? template.variables : [];
      const bodyVariables: Record<string, string> = templateOrder.length > 0
        ? templateOrder.reduce<Record<string, string>>((acc, key) => {
          const value = input.templateVariables[key];
          if (typeof value === "string") {
            acc[key] = value;
          }
          return acc;
        }, {})
        : { ...input.templateVariables };

      result = await sendWhatsAppMessage(
        prefs.whatsapp_phone_id,
        prefs.whatsapp_access_token,
        recipientPhone,
        template.whatsapp_template_name,
        input.templateVariables,
        {
          languageCode: "es",
          bodyVariables,
          bodyVariableOrder: templateOrder.length > 0 ? templateOrder : undefined,
        },
      );
    } catch (initialError) {
      const initialMessage = initialError instanceof Error ? initialError.message : "";
      const shouldRetryWithEnglish = initialMessage.includes("(#132001)");
      const shouldRetryWithHeaderId = initialMessage.includes("(#132000)") && Boolean(input.templateVariables.id);

      if (shouldRetryWithHeaderId) {
        const { id, ...bodyVariables } = input.templateVariables;
        const headerId = typeof id === "string" ? id : "";
        try {
          result = await sendWhatsAppMessage(
            prefs.whatsapp_phone_id,
            prefs.whatsapp_access_token,
            recipientPhone,
            template.whatsapp_template_name,
            input.templateVariables,
            {
              headerTextParameters: [headerId],
              bodyVariables,
            },
          );
        } catch {
          throw initialError;
        }
      } else {
        if (!shouldRetryWithEnglish) {
          throw initialError;
        }

        result = await sendWhatsAppMessage(
          prefs.whatsapp_phone_id,
          prefs.whatsapp_access_token,
          recipientPhone,
          template.whatsapp_template_name,
          input.templateVariables,
          { languageCode: "en_US" },
        );
      }
    }

    if (notificationId) {
      await updateNotificationStatus(adminClient, notificationId, "sent", result.messageId);
    }

    return {
      success: true,
      notificationId,
      whatsappMessageId: result.messageId,
      status: result.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    if (notificationId) {
      await updateNotificationStatus(adminClient, notificationId, "failed", undefined, errorMessage);
    }

    throw createError({
      statusCode: 502,
      statusMessage: `Error enviando WhatsApp: ${errorMessage}`,
    });
  }
};
