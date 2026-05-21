import type { NotificationPreferences, NotificationTemplate, WhatsAppMessageResponse, WhatsAppErrorResponse } from "@/types/notifications";

const WHATSAPP_API_BASE = "https://graph.facebook.com/v18.0";

export interface WhatsAppTemplateVariable {
  type: "text";
  text: string;
}

export interface WhatsAppTemplatePayload {
  name: string;
  language: { code: string };
  components: Array<{
    type: string;
    parameters: Array<{
      type: string;
      text?: string;
    }>;
  }>;
}

/**
 * Envia mensaje de WhatsApp usando Cloud API de Meta
 * https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */
export const sendWhatsAppMessage = async (
  phoneId: string,
  accessToken: string,
  recipientPhone: string,
  templateName: string,
  templateVariables: Record<string, string>,
  languageCode = "es"
): Promise<{ messageId: string; status: string }> => {
  const url = `${WHATSAPP_API_BASE}/${phoneId}/messages`;

  // Construir parametros del template
  const parameters = Object.entries(templateVariables).map(([_, value]) => ({
    type: "text" as const,
    text: value,
  }));

  const body: WhatsAppTemplatePayload = {
    name: templateName,
    language: { code: languageCode },
    components: [
      {
        type: "body",
        parameters,
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: recipientPhone,
      type: "template",
      template: body,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as WhatsAppErrorResponse;
    throw new Error(
      `WhatsApp API error: ${errorData.error?.message ?? "Unknown error"} (code: ${errorData.error?.code})`
    );
  }

  const result = data as WhatsAppMessageResponse;
  const message = result.messages?.[0];

  if (!message) {
    throw new Error("No message ID returned from WhatsApp API");
  }

  return {
    messageId: message.id,
    status: message.message_status ?? "sent",
  };
};

/**
 * Verifica credenciales de WhatsApp
 */
export const verifyWhatsAppCredentials = async (
  phoneId: string,
  accessToken: string
): Promise<{ valid: boolean; error?: string }> => {
  try {
    const url = `${WHATSAPP_API_BASE}/${phoneId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        valid: false,
        error: error.error?.message ?? "Credenciales invalidas",
      };
    }

    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : "Error de conexion",
    };
  }
};

/**
 * Reemplaza variables en un template body
 */
export const renderTemplateBody = (
  templateBody: string,
  variables: Record<string, string>
): string => {
  let result = templateBody;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
};

/**
 * Obtiene template activo para una organizacion y tipo
 */
export const getActiveTemplate = async (
  supabaseClient: any,
  organizationId: string,
  notificationType: string
): Promise<NotificationTemplate | null> => {
  const { data, error } = await supabaseClient
    .from("notification_templates")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("notification_type", notificationType)
    .eq("is_active", true)
    .single();

  if (error) {
    return null;
  }

  return data;
};

/**
 * Obtiene preferencias de notificacion de una organizacion
 */
export const getNotificationPreferences = async (
  supabaseClient: any,
  organizationId: string
): Promise<NotificationPreferences | null> => {
  const { data, error } = await supabaseClient
    .from("notification_preferences")
    .select("*")
    .eq("organization_id", organizationId)
    .single();

  if (error) {
    return null;
  }

  return data;
};

/**
 * Loguea una notificacion en la base de datos
 */
export const logNotification = async (
  supabaseClient: any,
  notificationData: {
    organization_id: string;
    notification_type: string;
    channel: string;
    recipient_phone: string;
    recipient_name?: string;
    template_id?: string;
    payload?: Record<string, unknown>;
    status?: string;
    whatsapp_message_id?: string;
    error_message?: string;
  }
): Promise<string | null> => {
  const { data, error } = await supabaseClient
    .from("notifications")
    .insert({
      organization_id: notificationData.organization_id,
      notification_type: notificationData.notification_type,
      channel: notificationData.channel,
      recipient_phone: notificationData.recipient_phone,
      recipient_name: notificationData.recipient_name ?? null,
      template_id: notificationData.template_id ?? null,
      payload: notificationData.payload ?? {},
      status: notificationData.status ?? "pending",
      whatsapp_message_id: notificationData.whatsapp_message_id ?? null,
      error_message: notificationData.error_message ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to log notification:", error);
    return null;
  }

  return data?.id;
};

/**
 * Actualiza el estado de una notificacion
 */
export const updateNotificationStatus = async (
  supabaseClient: any,
  notificationId: string,
  status: string,
  whatsappMessageId?: string,
  errorMessage?: string
): Promise<void> => {
  const updateData: Record<string, unknown> = {
    status,
    sent_at: new Date().toISOString(),
  };

  if (whatsappMessageId) {
    updateData.whatsapp_message_id = whatsappMessageId;
  }

  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  await supabaseClient
    .from("notifications")
    .update(updateData)
    .eq("id", notificationId);
};
