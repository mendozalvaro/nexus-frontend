import { createClient } from "@supabase/supabase-js";
import { createError } from "h3";
import { serverSupabaseUser } from "#supabase/server";

import type { H3Event } from "h3";
import type { Database } from "@/types/database.types";

type ProfileSummary = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "organization_id" | "role" | "full_name" | "email" | "avatar_url" | "phone" | "is_active"
>;

type AdminClient = ReturnType<typeof createClient<Database>>;

export interface TenantContext {
  adminClient: AdminClient;
  userId: string;
  profile: ProfileSummary;
  organizationId: string;
  role: Database["public"]["Enums"]["user_role"];
}

const ROLE_SET = new Set<Database["public"]["Enums"]["user_role"]>([
  "admin",
  "manager",
  "employee",
  "client",
]);

const normalizeRole = (value: unknown): Database["public"]["Enums"]["user_role"] | null => {
  if (typeof value !== "string") {
    return null;
  }

  return ROLE_SET.has(value as Database["public"]["Enums"]["user_role"])
    ? (value as Database["public"]["Enums"]["user_role"])
    : null;
};

const buildAdminClient = (event: H3Event): AdminClient => {
  const config = useRuntimeConfig(event);
  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = config.supabaseServiceRoleKey;

  if (!supabaseUrl || !serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Configuracion de Supabase incompleta para contexto tenant.",
    });
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const requireTenantContext = async (event: H3Event): Promise<TenantContext> => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "No autorizado." });
  }

  const adminClient = buildAdminClient(event);
  const { data: profile, error } = await adminClient
    .from("profiles")
    .select("id, organization_id, role, full_name, email, avatar_url, phone, is_active")
    .eq("id", user.id)
    .maybeSingle<ProfileSummary>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `No se pudo cargar perfil para contexto tenant: ${error.message}`,
    });
  }

  if (!profile) {
    throw createError({
      statusCode: 403,
      statusMessage: "No se encontro un perfil asociado al usuario autenticado.",
    });
  }

  if (!profile.organization_id) {
    throw createError({
      statusCode: 403,
      statusMessage: "El perfil autenticado no tiene organization_id asignado.",
    });
  }

  if (profile.is_active === false) {
    throw createError({
      statusCode: 403,
      statusMessage: "El perfil autenticado esta inactivo.",
    });
  }

  const resolvedRole = profile.role
    ?? normalizeRole((user.user_metadata as { role?: unknown } | null | undefined)?.role)
    ?? normalizeRole((user.app_metadata as { role?: unknown } | null | undefined)?.role);

  if (!resolvedRole) {
    throw createError({
      statusCode: 403,
      statusMessage: "No se pudo resolver el rol del usuario autenticado.",
    });
  }

  return {
    adminClient,
    userId: user.id,
    profile,
    organizationId: profile.organization_id,
    role: resolvedRole,
  };
};
