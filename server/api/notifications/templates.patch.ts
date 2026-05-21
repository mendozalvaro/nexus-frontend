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

const updateTemplateSchema = z.object({
  notificationType: z.enum(["sale_receipt", "appointment_confirmation", "appointment_reminder", "appointment_status_change"]),
  whatsappTemplateName: z.string().min(1).max(512),
  templateBody: z.string().min(1).max(1024),
  isActive: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, updateTemplateSchema.parse);

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
    .from("notification_templates")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .eq("notification_type", body.notificationType)
    .single();

  if (existing) {
    const { data: updated, error } = await supabase
      .from("notification_templates")
      .update({
        whatsapp_template_name: body.whatsappTemplateName,
        template_body: body.templateBody,
        is_active: body.isActive ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      throw createError({ statusCode: 500, statusMessage: "Failed to update template" });
    }

    return updated;
  } else {
    const { data: created, error } = await supabase
      .from("notification_templates")
      .insert({
        organization_id: profile.organization_id,
        notification_type: body.notificationType,
        whatsapp_template_name: body.whatsappTemplateName,
        template_body: body.templateBody,
        is_active: body.isActive ?? true,
      })
      .select()
      .single();

    if (error) {
      throw createError({ statusCode: 500, statusMessage: "Failed to create template" });
    }

    return created;
  }
});
