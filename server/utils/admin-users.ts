import { createError, getHeader, readBody } from "h3";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { H3Event } from "h3";

import type { Database, Json } from "@/types/database.types";
import {
  flattenPlanLimits,
  readBooleanPlanPermissions,
  resolvePlanBooleanLimit,
  resolvePlanNumericLimit,
  resolvePlanPermission,
  type PlanLimitScalar,
} from "@/utils/subscription-plan";

type UserRole = Database["public"]["Enums"]["user_role"];
type InternalRole = Exclude<UserRole, "client">;

interface AdminContext {
  adminClient: ReturnType<typeof createClient<Database>>;
  organizationId: string;
  userId: string;
  actorRole: InternalRole;
  capabilities: {
    maxUsers: number;
    currentUsersCount: number;
    canCreateManager: boolean;
    planPermissions: Record<string, boolean>;
    planLimits: Record<string, PlanLimitScalar>;
  };
}

const INTERNAL_ROLES: InternalRole[] = ["admin", "manager", "employee"];

const baseUserSchema = z.object({
  fullName: z.string().trim().min(3, "El nombre completo es obligatorio."),
  email: z.string().trim().email("Ingresa un email valido."),
  role: z.enum(["admin", "manager", "employee"] satisfies UserRole[]),
  branchId: z.string().uuid().nullable(),
  assignedBranchIds: z.array(z.string().uuid()).default([]),
  primaryBranchId: z.string().uuid().nullable().default(null),
});

export const createUserSchema = baseUserSchema.extend({
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres."),
});

export const updateUserSchema = baseUserSchema.extend({
  password: z.string().min(8).optional(),
});

const isInternalRole = (role: UserRole | null | undefined): role is InternalRole => {
  return INTERNAL_ROLES.includes(role as InternalRole);
};

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
      statusMessage: "Falta NUXT_SUPABASE_SERVICE_ROLE_KEY para gestionar usuarios desde el servidor.",
    });
  }

  return { url, anonKey, serviceRoleKey };
};

const parseCapabilities = (payload: unknown) => {
  const record = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};

  return {
    maxUsers: typeof record.maxUsers === "number" ? record.maxUsers : 0,
    currentUsersCount: typeof record.currentUsersCount === "number" ? record.currentUsersCount : 0,
    canCreateManager: typeof record.canCreateManager === "boolean" ? record.canCreateManager : false,
    planPermissions: readBooleanPlanPermissions(record.permissions),
    planLimits: flattenPlanLimits(record.limits),
  };
};

const auditPermissionDenied = async (
  adminClient: AdminContext["adminClient"],
  payload: {
    userId: string;
    organizationId: string;
    reason: string;
    message: string;
    module?: string;
    role?: UserRole;
    currentRole?: UserRole | null;
    expected?: number;
    current?: number;
  },
) => {
  try {
    await adminClient.from("audit_logs").insert({
      user_id: payload.userId,
      action: "PERMISSION_DENIED",
      table_name: "subscription_limits",
      record_id: payload.organizationId,
      context: {
        reason: payload.reason,
        message: payload.message,
        module: payload.module ?? null,
        role: payload.role ?? null,
        current_role: payload.currentRole ?? null,
        expected: payload.expected ?? null,
        current: payload.current ?? null,
      } as Json,
    });
  } catch {
    // Ignore audit write failures to avoid masking access errors.
  }
};

const resolveTotalUsersLimit = (capabilities: AdminContext["capabilities"]): number => {
  return resolvePlanNumericLimit(capabilities.planLimits, [
    "users",
    "users.max",
    "seats",
    "seats.total",
  ]) ?? capabilities.maxUsers;
};

const resolveRoleLimit = (
  capabilities: AdminContext["capabilities"],
  role: InternalRole,
): number | null => {
  return resolvePlanNumericLimit(capabilities.planLimits, [
    `roles.${role}`,
    `roles.${role}.max`,
    `${role}.max`,
    `users.${role}`,
  ]);
};

const isUsersUnlimited = (capabilities: AdminContext["capabilities"]): boolean => {
  return resolvePlanBooleanLimit(capabilities.planLimits, [
    "users_unlimited",
    "users.unlimited",
    "usersUnlimited",
  ]) === true;
};

export const requireAdminContext = async (event: H3Event): Promise<AdminContext> => {
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

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, organization_id, role, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  const actorRole = profile?.role;
  const canManageUsers = actorRole === "admin" || actorRole === "manager";
  if (profileError || !profile?.organization_id || !canManageUsers || profile.is_active === false) {
    throw createError({
      statusCode: 403,
      statusMessage: "Solo usuarios admin o manager activos pueden gestionar usuarios.",
    });
  }

  const { data: capabilityData, error: capabilityError } = await adminClient.rpc(
    "get_organization_capabilities",
    { input_org_id: profile.organization_id },
  );

  if (capabilityError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron validar las capacidades del plan actual.",
    });
  }

  return {
    adminClient,
    organizationId: profile.organization_id,
    userId: profile.id,
    actorRole,
    capabilities: parseCapabilities(capabilityData),
  };
};

export const assertPlanPermission = async (
  context: AdminContext,
  moduleKey: string,
) => {
  const enabled = resolvePlanPermission(context.capabilities.planPermissions, moduleKey, true);
  if (enabled) {
    return;
  }

  const message = "Tu plan actual no permite operar el modulo de usuarios.";
  await auditPermissionDenied(context.adminClient, {
    userId: context.userId,
    organizationId: context.organizationId,
    reason: "module_permission",
    message,
    module: moduleKey,
  });

  throw createError({
    statusCode: 403,
    statusMessage: message,
  });
};

export const assertRoleRules = (
  context: AdminContext,
  role: UserRole,
  branchId: string | null,
  assignedBranchIds: string[],
  primaryBranchId: string | null,
  canCreateManager: boolean,
  currentRole?: UserRole | null,
) => {
  if (context.actorRole === "manager" && role !== "employee") {
    throw createError({
      statusCode: 403,
      statusMessage: "Un manager solo puede asignar el rol employee.",
    });
  }

  if (context.actorRole === "admin" && role === "admin" && currentRole !== "admin") {
    throw createError({
      statusCode: 403,
      statusMessage: "Solo system puede asignar el rol admin.",
    });
  }

  if (role === "manager" && currentRole !== "manager" && !canCreateManager) {
    const message = "Tu plan actual no permite crear ni promover usuarios con rol manager.";
    void auditPermissionDenied(context.adminClient, {
      userId: context.userId,
      organizationId: context.organizationId,
      reason: "role_permission",
      message,
      role,
      currentRole: currentRole ?? null,
    });
    throw createError({
      statusCode: 403,
      statusMessage: message,
    });
  }

  if ((role === "manager" || role === "employee") && !branchId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Los usuarios manager y employee requieren una sucursal principal.",
    });
  }

  if (role === "manager" && assignedBranchIds.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Los managers solo pueden tener una sucursal primaria.",
    });
  }

  if (role === "admin" && assignedBranchIds.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Los usuarios admin no gestionan asignaciones de sucursal.",
    });
  }

  if (role === "employee" && branchId) {
    const uniqueBranchIds = new Set(assignedBranchIds);
    uniqueBranchIds.add(branchId);

    if (primaryBranchId && !uniqueBranchIds.has(primaryBranchId)) {
      throw createError({
        statusCode: 400,
        statusMessage: "La sucursal primaria del empleado debe pertenecer a sus asignaciones.",
      });
    }
  }
};

export const assertUserLimit = async (
  context: AdminContext,
  targetRole: UserRole,
  currentRole?: UserRole | null,
) => {
  const { data: profileRows, error } = await context.adminClient
    .from("profiles")
    .select("role")
    .eq("organization_id", context.organizationId)
    .neq("role", "client");

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron validar los limites de usuarios de la organizacion.",
    });
  }

  const roleCounters: Record<InternalRole, number> = {
    admin: 0,
    manager: 0,
    employee: 0,
  };

  for (const row of profileRows ?? []) {
    if (isInternalRole(row.role)) {
      roleCounters[row.role] += 1;
    }
  }

  const currentInternal = isInternalRole(currentRole ?? null) ? 1 : 0;
  const targetInternal = isInternalRole(targetRole) ? 1 : 0;
  const currentTotal = roleCounters.admin + roleCounters.manager + roleCounters.employee;
  const projectedTotal = currentTotal + targetInternal - currentInternal;

  if (!isUsersUnlimited(context.capabilities)) {
    const totalLimit = resolveTotalUsersLimit(context.capabilities);
    if (projectedTotal > totalLimit) {
      const message = `Tu plan alcanzo el limite de ${totalLimit} usuario(s). Actualiza la suscripcion para agregar mas.`;
      await auditPermissionDenied(context.adminClient, {
        userId: context.userId,
        organizationId: context.organizationId,
        reason: "users_limit",
        message,
        role: targetRole,
        currentRole: currentRole ?? null,
        expected: totalLimit,
        current: projectedTotal,
      });
      throw createError({
        statusCode: 409,
        statusMessage: message,
      });
    }
  }

  if (!isInternalRole(targetRole)) {
    return;
  }

  const roleLimit = resolveRoleLimit(context.capabilities, targetRole);
  if (roleLimit === null) {
    return;
  }

  const projectedRoleCount = roleCounters[targetRole] + (currentRole === targetRole ? 0 : 1);
  if (projectedRoleCount <= roleLimit) {
    return;
  }

  const message = `Tu plan alcanzo el limite de ${roleLimit} usuario(s) con rol ${targetRole}.`;
  await auditPermissionDenied(context.adminClient, {
    userId: context.userId,
    organizationId: context.organizationId,
    reason: "role_limit",
    message,
    role: targetRole,
    currentRole: currentRole ?? null,
    expected: roleLimit,
    current: projectedRoleCount,
  });

  throw createError({
    statusCode: 409,
    statusMessage: message,
  });
};

export const assertBranchesBelongToOrganization = async (
  adminClient: AdminContext["adminClient"],
  organizationId: string,
  branchIds: string[],
) => {
  if (branchIds.length === 0) {
    return;
  }

  const uniqueBranchIds = Array.from(new Set(branchIds));
  const { data, error } = await adminClient
    .from("branches")
    .select("id")
    .eq("organization_id", organizationId)
    .in("id", uniqueBranchIds);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron validar las sucursales seleccionadas.",
    });
  }

  if ((data ?? []).length !== uniqueBranchIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "Se detectaron sucursales fuera de la organizacion actual.",
    });
  }
};

export const syncEmployeeAssignments = async (
  adminClient: AdminContext["adminClient"],
  userId: string,
  role: UserRole,
  branchId: string | null,
  assignedBranchIds: string[],
  primaryBranchId: string | null,
) => {
  await adminClient.from("employee_branch_assignments").delete().eq("user_id", userId);

  if ((role === "admin" || role === "client") || !branchId) {
    return;
  }

  if (role === "manager") {
    const { error: managerAssignmentError } = await adminClient
      .from("employee_branch_assignments")
      .insert({
        user_id: userId,
        branch_id: branchId,
        is_primary: true,
        can_manage_inventory: true,
        can_override_prices: false,
      });

    if (managerAssignmentError) {
      throw createError({
        statusCode: 500,
        statusMessage: "No se pudo guardar la sucursal primaria del manager.",
      });
    }

    return;
  }

  const uniqueBranchIds = Array.from(new Set([branchId, ...assignedBranchIds]));
  const primaryId = primaryBranchId ?? branchId;

  const payload = uniqueBranchIds.map((currentBranchId) => ({
    user_id: userId,
    branch_id: currentBranchId,
    is_primary: currentBranchId === primaryId,
    can_manage_inventory: false,
    can_override_prices: false,
  }));

  const { error } = await adminClient.from("employee_branch_assignments").insert(payload);
  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron guardar las asignaciones de sucursal del empleado.",
    });
  }
};

export const readValidatedAdminBody = async <T>(event: H3Event, schema: z.ZodSchema<T>): Promise<T> => {
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  return parsed.data;
};

export const sanitizeEmail = (email: string) => email.trim().toLowerCase();

export const buildUserMetadata = (payload: {
  fullName: string;
  organizationId: string;
  role: UserRole;
  branchId?: string | null;
}) => ({
  full_name: payload.fullName,
  organization_id: payload.organizationId,
  role: payload.role,
});
