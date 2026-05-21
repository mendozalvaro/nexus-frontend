import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const createServiceClient = () => {
  const url = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  return createClient<Database, "public">(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const updateSchema = z.object({
  whatsapp_enabled: z.boolean().optional(),
  whatsapp_phone_id: z.string().nullable().optional(),
  whatsapp_access_token: z.string().nullable().optional(),
  whatsapp_business_account_id: z.string().nullable().optional(),
  send_sale_receipt: z.boolean().optional(),
  send_appointment_confirmation: z.boolean().optional(),
  send_appointment_reminder: z.boolean().optional(),
  send_appointment_status_change: z.boolean().optional(),
  reminder_minutes_before: z.number().int().min(5).max(1440).optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, updateSchema.parse);

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

  if (!profile?.organization_id || profile.role !== "admin") {
    throw createError({ statusCode: 403, statusMessage: "Admin access required" });
  }

  const { data: existing } = await supabase
    .from("notification_preferences")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .single();

  if (existing) {
    const { data: updated, error } = await supabase
      .from("notification_preferences")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", profile.organization_id)
      .select()
      .single();

    if (error) {
      throw createError({ statusCode: 500, statusMessage: "Failed to update preferences" });
    }

    const { whatsapp_access_token, ...safePrefs } = updated;
    return safePrefs;
  } else {
    const { data: created, error } = await supabase
      .from("notification_preferences")
      .insert({
        organization_id: profile.organization_id,
        ...body,
      })
      .select()
      .single();

    if (error) {
      throw createError({ statusCode: 500, statusMessage: "Failed to create preferences" });
    }

    const { whatsapp_access_token, ...safePrefs } = created;
    return safePrefs;
  }
});
