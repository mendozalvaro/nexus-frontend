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

const historySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(["sale_receipt", "appointment_confirmation", "appointment_reminder", "appointment_status_change"]).optional(),
  status: z.enum(["pending", "sent", "failed", "delivered", "read"]).optional(),
});

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, historySchema.parse);

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

  const from = (query.page - 1) * query.limit;
  const to = from + query.limit - 1;

  let queryBuilder = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (query.type) {
    queryBuilder = queryBuilder.eq("notification_type", query.type);
  }

  if (query.status) {
    queryBuilder = queryBuilder.eq("status", query.status);
  }

  const { data, error, count } = await queryBuilder;

  if (error) {
    throw createError({ statusCode: 500, statusMessage: "Failed to fetch notification history" });
  }

  return {
    notifications: data,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / query.limit),
    },
  };
});
