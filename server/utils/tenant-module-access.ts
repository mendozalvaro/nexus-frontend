import { createError } from "h3";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type AdminClient = SupabaseClient<Database, "public">;
type UserRole = Database["public"]["Enums"]["user_role"];
type RolePermissionRow = Pick<
  Database["public"]["Tables"]["role_module_permissions"]["Row"],
  "can_view" | "can_create" | "can_edit" | "can_delete" | "can_export" | "can_manage"
>;

export type TenantModuleKey =
  | "clients"
  | "users"
  | "catalog.products"
  | "catalog.services"
  | "catalog.rooms"
  | "catalog.categories.products"
  | "catalog.categories.services"
  | "catalog.categories.rooms"
  | "reports.sales"
  | "reports.services"
  | "reports.lodging"
  | "reservations"
  | "appointments"
  | "service_assignment"
  | "inventory"
  | "pos.sales"
  | "branches"
  | "settings"
  | "dashboard"
  | "profile";

export type TenantModuleAction =
  | "can_view"
  | "can_create"
  | "can_edit"
  | "can_delete"
  | "can_export"
  | "can_manage";

type CapabilityPayload = {
  permissions?: Record<string, boolean>;
  businessTypes?: string[];
};

const capabilityCache = new Map<string, Promise<CapabilityPayload>>();

const DEFAULT_ROLE_ACCESS: Record<UserRole, Partial<Record<TenantModuleKey, Partial<Record<TenantModuleAction, boolean>>>>> = {
  admin: {},
  manager: {
    dashboard: { can_view: true },
    clients: { can_view: true, can_edit: true },
    users: { can_view: true, can_create: true, can_edit: true },
    "catalog.products": { can_view: true, can_edit: true },
    "catalog.services": { can_view: true, can_edit: true },
    "catalog.rooms": { can_view: true, can_edit: true },
    "catalog.categories.products": { can_view: true, can_edit: true },
    "catalog.categories.services": { can_view: true, can_edit: true },
    "catalog.categories.rooms": { can_view: true, can_edit: true },
    inventory: { can_view: true, can_create: true, can_edit: true },
    appointments: { can_view: true, can_create: true, can_edit: true },
    service_assignment: { can_view: true, can_create: true, can_edit: true },
    reservations: { can_view: true, can_create: true, can_edit: true, can_delete: true },
    "pos.sales": { can_view: true, can_create: true, can_edit: true },
    "reports.sales": { can_view: true, can_export: true },
    "reports.services": { can_view: true, can_export: true },
    "reports.lodging": { can_view: true, can_export: true },
    profile: { can_view: true, can_edit: true },
  },
  employee: {
    dashboard: { can_view: true },
    appointments: { can_view: true, can_create: true, can_edit: true },
    reservations: { can_view: true, can_create: true, can_edit: true, can_delete: true },
    "pos.sales": { can_view: true, can_create: true },
    profile: { can_view: true, can_edit: true },
  },
  client: {
    appointments: { can_view: true, can_create: true },
    profile: { can_view: true, can_edit: true },
  },
};

const MODULE_BUSINESS_TYPES: Partial<Record<TenantModuleKey, string[]>> = {
  clients: ["product", "service", "lodging"],
  "catalog.products": ["product"],
  "catalog.categories.products": ["product"],
  inventory: ["product"],
  "pos.sales": ["product"],
  "reports.sales": ["product"],
  appointments: ["service"],
  service_assignment: ["service"],
  "catalog.services": ["service"],
  "catalog.categories.services": ["service"],
  "reports.services": ["service"],
  reservations: ["lodging"],
  "catalog.rooms": ["lodging"],
  "catalog.categories.rooms": ["lodging"],
  "reports.lodging": ["lodging"],
};

const readCapabilities = async (
  adminClient: AdminClient,
  organizationId: string,
): Promise<CapabilityPayload> => {
  const cached = capabilityCache.get(organizationId);
  if (cached) {
    return cached;
  }

  const loader = (async () => {
    const { data, error } = await adminClient.rpc("get_organization_capabilities", {
      input_org_id: organizationId,
    });

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: "No se pudieron validar las capacidades de la organizacion.",
      });
    }

    const payload = (typeof data === "object" && data !== null ? data : {}) as {
      permissions?: unknown;
      businessTypes?: unknown;
    };

    return {
      permissions: typeof payload.permissions === "object" && payload.permissions !== null
        ? payload.permissions as Record<string, boolean>
        : {},
      businessTypes: Array.isArray(payload.businessTypes)
        ? payload.businessTypes.filter((value): value is string => typeof value === "string")
        : [],
    };
  })();

  capabilityCache.set(organizationId, loader);

  try {
    return await loader;
  } finally {
    capabilityCache.delete(organizationId);
  }
};

const hasFallbackAccess = (
  role: UserRole,
  moduleKey: TenantModuleKey,
  action: TenantModuleAction,
): boolean => {
  if (role === "admin") {
    return true;
  }

  const moduleAccess = DEFAULT_ROLE_ACCESS[role]?.[moduleKey];
  if (!moduleAccess) {
    return false;
  }

  return moduleAccess.can_manage === true || moduleAccess[action] === true;
};

const hasRequiredBusinessType = (
  moduleKey: TenantModuleKey,
  businessTypes: string[],
): boolean => {
  const required = MODULE_BUSINESS_TYPES[moduleKey];
  if (!required || required.length === 0) {
    return true;
  }

  return required.some((businessType) => businessTypes.includes(businessType));
};

export const assertTenantModuleAccess = async (params: {
  adminClient: AdminClient;
  organizationId: string;
  role: UserRole;
  roleId?: string | null;
  moduleKey: TenantModuleKey;
  action?: TenantModuleAction;
}) => {
  const action = params.action ?? "can_view";
  const capabilities = await readCapabilities(params.adminClient, params.organizationId);

  if (!hasRequiredBusinessType(params.moduleKey, capabilities.businessTypes ?? [])) {
    throw createError({
      statusCode: 403,
      statusMessage: "La organizacion no tiene habilitado el tipo de negocio requerido para este modulo.",
    });
  }

  const planPermissions = capabilities.permissions ?? {};
  if (Object.keys(planPermissions).length > 0 && planPermissions[params.moduleKey] === false) {
    throw createError({
      statusCode: 403,
      statusMessage: "Tu plan actual no permite operar este modulo.",
    });
  }

  const defaultAllowed = hasFallbackAccess(params.role, params.moduleKey, action);
  if (!params.roleId) {
    if (defaultAllowed) {
      return;
    }

    throw createError({
      statusCode: 403,
      statusMessage: "Tu rol no tiene permiso para operar este modulo.",
    });
  }

  const { data, error } = await params.adminClient
    .from("role_module_permissions")
    .select("can_view, can_create, can_edit, can_delete, can_export, can_manage")
    .eq("role_id", params.roleId)
    .eq("module_key", params.moduleKey)
    .maybeSingle<RolePermissionRow>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron validar los permisos del rol para este modulo.",
    });
  }

  if (!data) {
    if (defaultAllowed) {
      return;
    }

    throw createError({
      statusCode: 403,
      statusMessage: "Tu rol no tiene permiso para operar este modulo.",
    });
  }

  if (data.can_manage === true || data[action] === true) {
    return;
  }

  throw createError({
    statusCode: 403,
    statusMessage: "No tienes permisos para ejecutar esta accion en el modulo solicitado.",
  });
};
