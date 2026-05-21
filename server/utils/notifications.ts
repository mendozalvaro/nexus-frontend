import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  sendWhatsAppMessage,
  getActiveTemplate,
  getNotificationPreferences,
  logNotification,
  updateNotificationStatus,
} from "../services/notifications/whatsapp";

const createServiceClient = () => {
  const url = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  return createClient<Database, "public">(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export interface SaleNotificationData {
  organizationId: string;
  customerName: string;
  customerPhone: string;
  branchName: string;
  ticketNumber: string;
  totalAmount: string;
  paymentMethod: string;
  transactionId: string;
}

export interface AppointmentNotificationData {
  organizationId: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  date: string;
  time: string;
  employeeName: string;
  appointmentId: string;
  status?: string;
}

/**
 * Envia notificacion de recibo de venta por WhatsApp
 */
export const sendSaleReceiptNotification = async (data: SaleNotificationData): Promise<{ success: boolean; notificationId?: string; error?: string }> => {
  const supabase = createServiceClient();

  try {
    const prefs = await getNotificationPreferences(supabase, data.organizationId);

    if (!prefs?.whatsapp_enabled || !prefs.send_sale_receipt) {
      return { success: false, error: "WhatsApp not enabled or sale receipt disabled" };
    }

    if (!prefs.whatsapp_phone_id || !prefs.whatsapp_access_token) {
      return { success: false, error: "WhatsApp credentials not configured" };
    }

    const template = await getActiveTemplate(supabase, data.organizationId, "sale_receipt");

    if (!template) {
      return { success: false, error: "Sale receipt template not found" };
    }

    const notificationId = await logNotification(supabase, {
      organization_id: data.organizationId,
      notification_type: "sale_receipt",
      channel: "whatsapp",
      recipient_phone: data.customerPhone,
      recipient_name: data.customerName,
      template_id: template.id,
      payload: {
        transactionId: data.transactionId,
        branchName: data.branchName,
        ticketNumber: data.ticketNumber,
        totalAmount: data.totalAmount,
        paymentMethod: data.paymentMethod,
      },
      status: "pending",
    });

    const result = await sendWhatsAppMessage(
      prefs.whatsapp_phone_id,
      prefs.whatsapp_access_token,
      data.customerPhone,
      template.whatsapp_template_name,
      {
        name: data.customerName,
        branch: data.branchName,
        ticket: data.ticketNumber,
        total: data.totalAmount,
        payment_method: data.paymentMethod,
      }
    );

    if (notificationId) {
      await updateNotificationStatus(supabase, notificationId, "sent", result.messageId);
    }

    return { success: true, notificationId: notificationId ?? undefined };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[WhatsApp] Sale receipt notification failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
};

/**
 * Envia notificacion de confirmacion de cita por WhatsApp
 */
export const sendAppointmentConfirmationNotification = async (data: AppointmentNotificationData): Promise<{ success: boolean; notificationId?: string; error?: string }> => {
  const supabase = createServiceClient();

  try {
    const prefs = await getNotificationPreferences(supabase, data.organizationId);

    if (!prefs?.whatsapp_enabled || !prefs.send_appointment_confirmation) {
      return { success: false, error: "WhatsApp not enabled or appointment confirmation disabled" };
    }

    if (!prefs.whatsapp_phone_id || !prefs.whatsapp_access_token) {
      return { success: false, error: "WhatsApp credentials not configured" };
    }

    const template = await getActiveTemplate(supabase, data.organizationId, "appointment_confirmation");

    if (!template) {
      return { success: false, error: "Appointment confirmation template not found" };
    }

    const notificationId = await logNotification(supabase, {
      organization_id: data.organizationId,
      notification_type: "appointment_confirmation",
      channel: "whatsapp",
      recipient_phone: data.customerPhone,
      recipient_name: data.customerName,
      template_id: template.id,
      payload: {
        appointmentId: data.appointmentId,
        serviceName: data.serviceName,
        date: data.date,
        time: data.time,
        employeeName: data.employeeName,
      },
      status: "pending",
    });

    const result = await sendWhatsAppMessage(
      prefs.whatsapp_phone_id,
      prefs.whatsapp_access_token,
      data.customerPhone,
      template.whatsapp_template_name,
      {
        name: data.customerName,
        service: data.serviceName,
        date: data.date,
        time: data.time,
        employee: data.employeeName,
      }
    );

    if (notificationId) {
      await updateNotificationStatus(supabase, notificationId, "sent", result.messageId);
    }

    return { success: true, notificationId: notificationId ?? undefined };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[WhatsApp] Appointment confirmation notification failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
};

/**
 * Envia notificacion de recordatorio de cita por WhatsApp
 */
export const sendAppointmentReminderNotification = async (data: AppointmentNotificationData): Promise<{ success: boolean; notificationId?: string; error?: string }> => {
  const supabase = createServiceClient();

  try {
    const prefs = await getNotificationPreferences(supabase, data.organizationId);

    if (!prefs?.whatsapp_enabled || !prefs.send_appointment_reminder) {
      return { success: false, error: "WhatsApp not enabled or appointment reminder disabled" };
    }

    if (!prefs.whatsapp_phone_id || !prefs.whatsapp_access_token) {
      return { success: false, error: "WhatsApp credentials not configured" };
    }

    const template = await getActiveTemplate(supabase, data.organizationId, "appointment_reminder");

    if (!template) {
      return { success: false, error: "Appointment reminder template not found" };
    }

    const reminderMinutes = prefs.reminder_minutes_before ?? 60;

    const notificationId = await logNotification(supabase, {
      organization_id: data.organizationId,
      notification_type: "appointment_reminder",
      channel: "whatsapp",
      recipient_phone: data.customerPhone,
      recipient_name: data.customerName,
      template_id: template.id,
      payload: {
        appointmentId: data.appointmentId,
        serviceName: data.serviceName,
        time: data.time,
        reminderMinutes,
      },
      status: "pending",
    });

    const result = await sendWhatsAppMessage(
      prefs.whatsapp_phone_id,
      prefs.whatsapp_access_token,
      data.customerPhone,
      template.whatsapp_template_name,
      {
        name: data.customerName,
        minutes: String(reminderMinutes),
        service: data.serviceName,
        time: data.time,
      }
    );

    if (notificationId) {
      await updateNotificationStatus(supabase, notificationId, "sent", result.messageId);
    }

    return { success: true, notificationId: notificationId ?? undefined };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[WhatsApp] Appointment reminder notification failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
};

/**
 * Envia notificacion de cambio de estado de cita por WhatsApp
 */
export const sendAppointmentStatusChangeNotification = async (data: AppointmentNotificationData & { status: string }): Promise<{ success: boolean; notificationId?: string; error?: string }> => {
  const supabase = createServiceClient();

  try {
    const prefs = await getNotificationPreferences(supabase, data.organizationId);

    if (!prefs?.whatsapp_enabled || !prefs.send_appointment_status_change) {
      return { success: false, error: "WhatsApp not enabled or status change notification disabled" };
    }

    if (!prefs.whatsapp_phone_id || !prefs.whatsapp_access_token) {
      return { success: false, error: "WhatsApp credentials not configured" };
    }

    const template = await getActiveTemplate(supabase, data.organizationId, "appointment_status_change");

    if (!template) {
      return { success: false, error: "Appointment status change template not found" };
    }

    const statusLabels: Record<string, string> = {
      confirmed: "confirmada",
      in_progress: "en progreso",
      completed: "completada",
      cancelled: "cancelada",
      no_show: "no asistida",
    };

    const statusLabel = statusLabels[data.status] ?? data.status;

    const notificationId = await logNotification(supabase, {
      organization_id: data.organizationId,
      notification_type: "appointment_status_change",
      channel: "whatsapp",
      recipient_phone: data.customerPhone,
      recipient_name: data.customerName,
      template_id: template.id,
      payload: {
        appointmentId: data.appointmentId,
        serviceName: data.serviceName,
        date: data.date,
        time: data.time,
        newStatus: data.status,
      },
      status: "pending",
    });

    const result = await sendWhatsAppMessage(
      prefs.whatsapp_phone_id,
      prefs.whatsapp_access_token,
      data.customerPhone,
      template.whatsapp_template_name,
      {
        name: data.customerName,
        status: statusLabel,
        service: data.serviceName,
        date: data.date,
        time: data.time,
      }
    );

    if (notificationId) {
      await updateNotificationStatus(supabase, notificationId, "sent", result.messageId);
    }

    return { success: true, notificationId: notificationId ?? undefined };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[WhatsApp] Appointment status change notification failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
};
