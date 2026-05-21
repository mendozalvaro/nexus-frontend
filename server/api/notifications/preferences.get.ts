import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getNotificationPreferences } from "../../services/notifications/whatsapp";

const createServiceClient = () => {
  const url = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  return createClient<Database, "public">(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export default defineEventHandler(async () => {
  const supabase = createServiceClient() as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    throw createError({ statusCode: 403, statusMessage: "No organization found" });
  }

  const prefs = await getNotificationPreferences(supabase, profile.organization_id);

  if (!prefs) {
    // Crear preferencias por defecto si no existen
    const { data: newPrefs, error } = await supabase
      .from("notification_preferences")
      .insert({
        organization_id: profile.organization_id,
        whatsapp_enabled: false,
        send_sale_receipt: true,
        send_appointment_confirmation: true,
        send_appointment_reminder: true,
        send_appointment_status_change: true,
        reminder_minutes_before: 60,
      })
      .select()
      .single();

    if (error) {
      throw createError({ statusCode: 500, statusMessage: "Failed to create preferences" });
    }

    return newPrefs;
  }

  // No devolver el token en la respuesta (seguridad)
  const { whatsapp_access_token, ...safePrefs } = prefs;
  return safePrefs;
});
