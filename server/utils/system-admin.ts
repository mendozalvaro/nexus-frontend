import { createClient } from "@supabase/supabase-js";
import { createError, getHeader, getQuery } from "h3";

import type { H3Event } from "h3";
import type { Database } from "@/types/database.types";

type AdminClient = ReturnType<typeof createClient<Database>>;

export interface SystemAdminContext {
  adminClient: AdminClient;
  userId: string;
  systemRole: "system" | "support";
}

export type SystemModuleAction =
  | "can_view"
  | "can_create"
  | "can_edit"
  | "can_delete"
  | "can_export"
  | "can_manage"
  | "can_approve"
  | "can_assign";

const getBearerToken = (event: H3Event): string => {
  const header = getHeader(event, "authorization");
  if (!header?.startsWith("Bearer ")) {
    throw createError({
      statusCode: 401,
      statusMessage: "No se recibio un token de autenticacion valido.",
    });
  }

  return header.slice("Bearer ".length);
};

const getSupabaseServerConfig = (event: H3Event) => {
  const config = useRuntimeConfig(event);
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = config.supabaseServiceRoleKey;

  if (!url || !anonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "La configuracion publica de Supabase esta incompleta.",
    });
  }

  if (!serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Falta NUXT_SUPABASE_SERVICE_ROLE_KEY para operaciones system.",
    });
  }

  return { url, anonKey, serviceRoleKey };
};

export const parsePagination = (event: H3Event, defaultPerPage = 10) => {
  const query = getQuery(event);

  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Number.parseInt(String(query.perPage ?? defaultPerPage), 10) || defaultPerPage),
  );
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  return { page, perPage, from, to };
};

export const requireSystemAdminContext = async (
  event: H3Event,
): Promise<SystemAdminContext> => {
  const { url, anonKey, serviceRoleKey } = getSupabaseServerConfig(event);
  const token = getBearerToken(event);

  const authClient = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: "No se pudo validar la sesion del usuario.",
    });
  }

  const adminClient = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: systemUser, error: systemUserError } = await adminClient
    .from("system_users")
    .select("user_id, role, is_active")
    .eq("user_id", authData.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (systemUserError || !systemUser) {
    throw createError({
      statusCode: 403,
      statusMessage: "No tienes permisos system para acceder a este recurso.",
    });
  }

  return {
    adminClient,
    userId: authData.user.id,
    systemRole: (systemUser.role ?? "support") as "system" | "support",
  };
};

export const assertSystemModuleAccess = async (
  context: SystemAdminContext,
  moduleKey: string,
  action: SystemModuleAction = "can_manage",
) => {
  if (context.systemRole === "system") {
    return;
  }

  const { data, error } = await context.adminClient
    .from("system_role_module_permissions")
    .select("can_view, can_create, can_edit, can_delete, can_export, can_manage, can_approve, can_assign")
    .eq("system_role", context.systemRole)
    .eq("module_key", moduleKey)
    .maybeSingle();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar permisos del rol system.",
    });
  }

  const allowed = Boolean(data?.[action]);
  if (allowed) {
    return;
  }

  throw createError({
    statusCode: 403,
    statusMessage: "No tienes permisos para este modulo.",
  });
};
