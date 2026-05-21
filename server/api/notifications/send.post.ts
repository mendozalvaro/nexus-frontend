import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  sendWhatsAppMessage,
  getActiveTemplate,
  getNotificationPreferences,
  logNotification,
  updateNotificationStatus,
} from "../../services/notifications/whatsapp";

const sendSchema = z.object({
  notificationType: z.enum(["sale_receipt", "appointment_confirmation", "appointment_reminder", "appointment_status_change"]),
  recipientPhone: z.string().min(8),
  recipientName: z.string().optional(),
  templateVariables: z.record(z.string(), z.string()),
  skipPreferenceCheck: z.boolean().optional().default(false),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, sendSchema.parse);

  const url = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const supabase = createClient<Database, "public">(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  // Obtener perfil para organization_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    throw createError({ statusCode: 403, statusMessage: "No organization found" });
  }

  const organizationId = profile.organization_id;

  // Verificar preferencias (a menos que se salte)
  if (!body.skipPreferenceCheck) {
    const prefs = await getNotificationPreferences(supabase, organizationId);

    if (!prefs?.whatsapp_enabled) {
      return {
        success: false,
        reason: "whatsapp_disabled",
        message: "WhatsApp no esta habilitado para esta organizacion",
      };
    }

    // Verificar si el tipo de notificacion esta habilitado
    const typeEnabledMap: Record<string, boolean> = {
      sale_receipt: prefs.send_sale_receipt,
      appointment_confirmation: prefs.send_appointment_confirmation,
      appointment_reminder: prefs.send_appointment_reminder,
      appointment_status_change: prefs.send_appointment_status_change,
    };

    if (!typeEnabledMap[body.notificationType]) {
      return {
        success: false,
        reason: "notification_type_disabled",
        message: `Notificacion ${body.notificationType} deshabilitada`,
      };
    }

    if (!prefs.whatsapp_phone_id || !prefs.whatsapp_access_token) {
      return {
        success: false,
        reason: "credentials_missing",
        message: "Credenciales de WhatsApp no configuradas",
      };
    }

    // Obtener template
    const template = await getActiveTemplate(supabase, organizationId, body.notificationType);

    if (!template) {
      return {
        success: false,
        reason: "template_not_found",
        message: `Template ${body.notificationType} no encontrado`,
      };
    }

    // Loguear notificacion pendiente
    const notificationId = await logNotification(supabase, {
      organization_id: organizationId,
      notification_type: body.notificationType,
      channel: "whatsapp",
      recipient_phone: body.recipientPhone,
      recipient_name: body.recipientName,
      template_id: template.id,
      payload: body.templateVariables,
      status: "pending",
    });

    try {
      // Enviar mensaje
      const result = await sendWhatsAppMessage(
        prefs.whatsapp_phone_id,
        prefs.whatsapp_access_token,
        body.recipientPhone,
        template.whatsapp_template_name,
        body.templateVariables as Record<string, string>
      );

      // Actualizar log
      if (notificationId) {
        await updateNotificationStatus(supabase, notificationId, "sent", result.messageId);
      }

      return {
        success: true,
        notificationId,
        whatsappMessageId: result.messageId,
        status: result.status,
      };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Error desconocido";

      if (notificationId) {
        await updateNotificationStatus(supabase, notificationId, "failed", undefined, errorMessage);
      }

      throw createError({
        statusCode: 502,
        statusMessage: `Error enviando WhatsApp: ${errorMessage}`,
      });
    }
  }

  // Si se salta verificacion de preferencias (uso interno/servicio)
  return {
    success: false,
    reason: "preference_check_required",
    message: "Set skipPreferenceCheck=false para usar preferencias de la organizacion",
  };
});
