import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { sendAppointmentReminderNotification } from "../../utils/notifications";

const createServiceClient = () => {
  const url = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  return createClient<Database, "public">(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

/**
 * Endpoint protegido para enviar recordatorios de citas por WhatsApp
 * Se debe ejecutar cada minuto via cron job
 * Protegido por secret key en header
 */
export default defineEventHandler(async (event) => {
  const cronSecret = getHeader(event, "x-cron-secret");
  const expectedSecret = process.env.NOTIFICATION_CRON_SECRET;

  if (!expectedSecret || cronSecret !== expectedSecret) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const supabase = createServiceClient() as any;

  // Obtener citas que empiezan en los proximos N minutos
  const now = new Date();
  const reminderWindow = 65; // minutos
  const reminderStart = new Date(now.getTime() + 55 * 60 * 1000); // 55 min desde ahora
  const reminderEnd = new Date(now.getTime() + reminderWindow * 60 * 1000); // 65 min desde ahora

  const { data: appointments, error } = await (supabase as any)
    .from("appointments")
    .select(`
      id,
      organization_id,
      customer_name,
      customer_phone,
      start_time,
      service_id
    `)
    .in("status", ["pending", "confirmed"])
    .gte("start_time", reminderStart.toISOString())
    .lte("start_time", reminderEnd.toISOString())
    .not("customer_phone", "is", null);

  if (error) {
    console.error("[Cron] Failed to fetch appointments:", error);
    return { success: false, error: error.message };
  }

  if (!appointments || appointments.length === 0) {
    return { success: true, sent: 0, message: "No appointments to remind" };
  }

  let sent = 0;
  let failed = 0;

  for (const appointment of appointments as any[]) {
    try {
      // Obtener preferencias de la organizacion
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("organization_id", appointment.organization_id)
        .single() as { data: { whatsapp_enabled: boolean; send_appointment_reminder: boolean; whatsapp_phone_id: string | null; whatsapp_access_token: string | null } | null; error: any };

      if (!prefs?.whatsapp_enabled || !prefs.send_appointment_reminder) {
        continue;
      }

      if (!prefs.whatsapp_phone_id || !prefs.whatsapp_access_token) {
        continue;
      }

      const timeStr = new Date(appointment.start_time).toLocaleTimeString("es-BO", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const result = await sendAppointmentReminderNotification({
        organizationId: appointment.organization_id,
        customerName: appointment.customer_name ?? "Cliente",
        customerPhone: appointment.customer_phone,
        serviceName: appointment.services?.name ?? "Servicio",
        date: new Date(appointment.start_time).toLocaleDateString("es-BO"),
        time: timeStr,
        employeeName: "Empleado",
        appointmentId: appointment.id,
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
        console.error(`[Cron] Failed to send reminder for appointment ${appointment.id}:`, result.error);
      }
    } catch (e) {
      failed++;
      console.error(`[Cron] Error sending reminder for appointment ${appointment.id}:`, e);
    }
  }

  return {
    success: true,
    sent,
    failed,
    total: appointments.length,
    message: `Sent ${sent} reminders, ${failed} failed out of ${appointments.length} appointments`,
  };
});
