import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

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
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    throw createError({ statusCode: 403, statusMessage: "No organization found" });
  }

  const { data: templates, error } = await supabase
    .from("notification_templates")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("notification_type");

  if (error) {
    throw createError({ statusCode: 500, statusMessage: "Failed to fetch templates" });
  }

  return templates;
});
