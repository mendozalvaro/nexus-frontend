import { createError, getHeader, readBody } from "h3";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { H3Event } from "h3";

import type { Database } from "@/types/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];

interface AdminContext {
  adminClient: ReturnType<typeof createClient<Database>>;
  organizationId: string;
  userId: string;
  capabilities: {
    maxUsers: number;
    currentUsersCount: number;
    canCreateManager: boolean;
  };
}

const baseUserSchema = z.object({
  fullName: z.string().trim().min(3, "El nombre completo es obligatorio."),
  email: z.string().trim().email("Ingresa un email válido."),
  role: z.enum(["admin", "manager", "employee"] satisfies UserRole[]),
  branchId: z.string().uuid().nullable(),
  assignedBranchIds: z.array(z.string().uuid()).default([]),
  primaryBranchId: z.string().uuid().nullable().default(null),
});

export const createUserSchema = baseUserSchema.extend({
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export const updateUserSchema = baseUserSchema.extend({
  password: z.string().min(8).optional(),
});

const getBearerToken = (event: H3Event): string => {
  const header = getHeader(event, "authorization");
  if (!header?.startsWith("Bearer ")) {
    throw createError({
      statusCode: 401,
      statusMessage: "No se recibió un token de autenticación válido.",
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
      statusMessage: "La configuración pública de Supabase está incompleta.",
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
  };
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
      statusMessage: "No se pudo validar la sesión del usuario.",
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

  if (profileError || !profile?.organization_id || profile.role !== "admin" || profile.is_active === false) {
    throw createError({
      statusCode: 403,
      statusMessage: "Solo administradores activos pueden gestionar usuarios.",
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
    capabilities: parseCapabilities(capabilityData),
  };
};

export const assertRoleRules = (
  role: UserRole,
  branchId: string | null,
  assignedBranchIds: string[],
  primaryBranchId: string | null,
  canCreateManager: boolean,
  currentRole?: UserRole | null,
) => {
  if (role === "manager" && currentRole !== "manager" && !canCreateManager) {
    throw createError({
      statusCode: 403,
      statusMessage: "Tu plan actual no permite crear ni promover usuarios con rol manager.",
    });
  }

  if ((role === "manager" || role === "employee") && !branchId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Los usuarios manager y employee requieren una sucursal principal.",
    });
  }

  if (role !== "employee" && assignedBranchIds.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Solo los empleados pueden tener asignaciones múltiples de sucursal.",
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

export const assertUserLimit = (capabilities: AdminContext["capabilities"]) => {
  if (capabilities.currentUsersCount >= capabilities.maxUsers) {
    throw createError({
      statusCode: 409,
      statusMessage: `Tu plan alcanzó el límite de ${capabilities.maxUsers} usuario(s). Actualiza la suscripción para agregar más.`,
    });
  }
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
      statusMessage: "Se detectaron sucursales fuera de la organización actual.",
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

  if (role !== "employee" || !branchId) {
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
      statusMessage: parsed.error.issues[0]?.message ?? "Payload inválido.",
    });
  }

  return parsed.data;
};

export const sanitizeEmail = (email: string) => email.trim().toLowerCase();

export const buildUserMetadata = (payload: {
  fullName: string;
  organizationId: string;
  role: UserRole;
  branchId: string | null;
}) => ({
  full_name: payload.fullName,
  organization_id: payload.organizationId,
  role: payload.role,
  branch_id: payload.branchId,
});
