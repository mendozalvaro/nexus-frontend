import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { sendNotificationWithPreferences } from "../services/notifications/sender";
import { getNotificationPreferences } from "../services/notifications/whatsapp";

const createServiceClient = () => {
  const url = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos para notificaciones.");
  }

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
    const result = await sendNotificationWithPreferences(supabase, data.organizationId, {
      notificationType: "sale_receipt",
      recipientPhone: data.customerPhone,
      recipientName: data.customerName,
      templateVariables: {
        name: data.customerName,
        branch: data.branchName,
        ticket: data.ticketNumber,
        total: data.totalAmount,
        payment_method: data.paymentMethod,
      },
    });

    if (!result.success) {
      return { success: false, error: result.message ?? result.reason ?? "Notification failed" };
    }

    return { success: true, notificationId: result.notificationId ?? undefined };
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
    const result = await sendNotificationWithPreferences(supabase, data.organizationId, {
      notificationType: "appointment_confirmation",
      recipientPhone: data.customerPhone,
      recipientName: data.customerName,
      templateVariables: {
        name: data.customerName,
        service: data.serviceName,
        date: data.date,
        time: data.time,
        employee: data.employeeName,
      },
    });
    if (!result.success) return { success: false, error: result.message ?? result.reason ?? "Notification failed" };
    return { success: true, notificationId: result.notificationId ?? undefined };
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
    const reminderMinutes = prefs?.reminder_minutes_before ?? 60;
    const result = await sendNotificationWithPreferences(supabase, data.organizationId, {
      notificationType: "appointment_reminder",
      recipientPhone: data.customerPhone,
      recipientName: data.customerName,
      templateVariables: {
        name: data.customerName,
        minutes: String(reminderMinutes),
        service: data.serviceName,
        time: data.time,
      },
    });
    if (!result.success) return { success: false, error: result.message ?? result.reason ?? "Notification failed" };
    return { success: true, notificationId: result.notificationId ?? undefined };
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
    const statusLabels: Record<string, string> = {
      confirmed: "confirmada",
      in_progress: "en progreso",
      completed: "completada",
      cancelled: "cancelada",
      no_show: "no asistida",
    };

    const statusLabel = statusLabels[data.status] ?? data.status;

    const result = await sendNotificationWithPreferences(supabase, data.organizationId, {
      notificationType: "appointment_status_change",
      recipientPhone: data.customerPhone,
      recipientName: data.customerName,
      templateVariables: {
        name: data.customerName,
        status: statusLabel,
        service: data.serviceName,
        date: data.date,
        time: data.time,
      },
    });
    if (!result.success) return { success: false, error: result.message ?? result.reason ?? "Notification failed" };
    return { success: true, notificationId: result.notificationId ?? undefined };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[WhatsApp] Appointment status change notification failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
};
