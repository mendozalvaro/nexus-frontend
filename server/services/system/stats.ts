import { createClient } from "@supabase/supabase-js";
import { createError } from "h3";

import type { H3Event } from "h3";
import type { Database } from "@/types/database.types";

type AdminClient = ReturnType<typeof createClient<Database>>;

const buildAdminClient = (event: H3Event): AdminClient => {
  const config = useRuntimeConfig(event);
  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = config.supabaseServiceRoleKey as string | undefined;

  if (!supabaseUrl || !serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Configuracion de Supabase incompleta.",
    });
  }

  return createClient<Database, "public">(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export interface SystemDashboardStats {
  pendingValidations: number;
  approvedToday: number;
  rejectedToday: number;
  totalSystemUsers: number;
  activeSystemUsers: number;
  totalOrganizations: number;
}

export async function getSystemDashboardStats(event: H3Event): Promise<SystemDashboardStats> {
  const adminClient = buildAdminClient(event);

  const [
    { data: paymentStats, error: paymentError },
    { count: totalSystemUsers, error: totalUsersError },
    { count: activeSystemUsers, error: activeUsersError },
    { count: totalOrganizations, error: orgError },
  ] = await Promise.all([
    adminClient.rpc("admin_payment_validation_stats"),
    adminClient.from("system_users").select("user_id", { count: "exact", head: true }),
    adminClient.from("system_users").select("user_id", { count: "exact", head: true }).eq("is_active", true),
    adminClient.from("organizations").select("id", { count: "exact", head: true }),
  ]);

  const firstError = paymentError ?? totalUsersError ?? activeUsersError ?? orgError;
  if (firstError) {
    throw createError({
      statusCode: 500,
      statusMessage: firstError.message,
    });
  }

  const row = Array.isArray(paymentStats) ? (paymentStats[0] ?? null) : null;

  return {
    pendingValidations: row?.pending_count ?? 0,
    approvedToday: row?.approved_today ?? 0,
    rejectedToday: row?.rejected_today ?? 0,
    totalSystemUsers: Number(totalSystemUsers ?? 0),
    activeSystemUsers: Number(activeSystemUsers ?? 0),
    totalOrganizations: Number(totalOrganizations ?? 0),
  };
}

