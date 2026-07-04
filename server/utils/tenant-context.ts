import { createError } from "h3";

import type { Database } from "@/types/database.types";
import { requireActorContext } from "./actor-context";

type ProfileSummary = NonNullable<Awaited<ReturnType<typeof requireActorContext>>["profile"]>;
type AdminClient = Awaited<ReturnType<typeof requireActorContext>>["adminClient"];

export interface TenantContext {
  adminClient: AdminClient;
  userId: string;
  profile: ProfileSummary;
  organizationId: string;
  role: Database["public"]["Enums"]["user_role"];
}

export interface StaffTenantContext extends TenantContext {
  role: Exclude<Database["public"]["Enums"]["user_role"], "client">;
}

export interface ClientTenantContext extends TenantContext {
  role: "client";
}

const resolveTenantContext = async (
  event: Parameters<typeof requireActorContext>[0],
): Promise<TenantContext & { actorType: Awaited<ReturnType<typeof requireActorContext>>["actorType"] }> => {
  const actor = await requireActorContext(event);

  if (!actor.profile) {
    throw createError({
      statusCode: 403,
      statusMessage: "No se encontro un perfil asociado al usuario autenticado.",
    });
  }

  if (!actor.profile.organization_id) {
    throw createError({
      statusCode: 403,
      statusMessage: "El perfil autenticado no tiene organization_id asignado.",
    });
  }

  if (actor.profile.is_active === false) {
    throw createError({
      statusCode: 403,
      statusMessage: "El perfil autenticado esta inactivo.",
    });
  }

  if (!actor.role) {
    throw createError({
      statusCode: 403,
      statusMessage: "No se pudo resolver el rol del usuario autenticado.",
    });
  }

  return {
    adminClient: actor.adminClient,
    userId: actor.userId,
    profile: actor.profile,
    organizationId: actor.profile.organization_id,
    role: actor.role,
    actorType: actor.actorType,
  };
};

export const requireTenantContext = async (
  event: Parameters<typeof requireActorContext>[0],
): Promise<TenantContext> => {
  const { actorType: _actorType, ...context } = await resolveTenantContext(event);
  return context;
};

export const requireStaffTenantContext = async (
  event: Parameters<typeof requireActorContext>[0],
): Promise<StaffTenantContext> => {
  const context = await resolveTenantContext(event);

  if (context.actorType !== "staff" || context.role === "client") {
    throw createError({
      statusCode: 403,
      statusMessage: "Este recurso requiere acceso staff.",
    });
  }

  const { actorType: _actorType, ...staffContext } = context;
  return staffContext as StaffTenantContext;
};

export const requireClientTenantContext = async (
  event: Parameters<typeof requireActorContext>[0],
): Promise<ClientTenantContext> => {
  const context = await resolveTenantContext(event);

  if (context.actorType !== "client" || context.role !== "client") {
    throw createError({
      statusCode: 403,
      statusMessage: "Este recurso requiere acceso cliente.",
    });
  }

  const { actorType: _actorType, ...clientContext } = context;
  return clientContext as ClientTenantContext;
};
