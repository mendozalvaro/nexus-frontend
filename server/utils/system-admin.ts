import { createClient } from "@supabase/supabase-js";
import { createError, getQuery } from "h3";

import type { H3Event } from "h3";
import type { Database } from "@/types/database.types";
import { requireActorContext } from "./actor-context";

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
  const actor = await requireActorContext(event, { preferSystem: true });

  if (actor.actorType !== "system" || !actor.systemRole) {
    throw createError({
      statusCode: 403,
      statusMessage: "No tienes permisos system para acceder a este recurso.",
    });
  }

  return {
    adminClient: actor.adminClient,
    userId: actor.userId,
    systemRole: actor.systemRole,
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
