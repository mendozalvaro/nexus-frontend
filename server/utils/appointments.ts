import { createClient } from "@supabase/supabase-js";
import { createError, getHeader, readBody } from "h3";
import { z } from "zod";

import type { H3Event } from "h3";

import type { Database, Json } from "@/types/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];
type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type GuestCustomerRow = Database["public"]["Tables"]["guest_customers"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ["pending", "confirmed", "in_progress"];
const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const guestWalkInSchema = z.object({
  fullName: z.string().trim().min(3, "El nombre del cliente es obligatorio."),
  phone: z.string().trim().min(7, "El teléfono del cliente es obligatorio."),
  notes: z.string().trim().max(240, "La nota del walk-in no puede superar 240 caracteres.").optional().default(""),
});

const baseAppointmentSchema = z.object({
  branchId: z.string().uuid("La sucursal seleccionada es inválida."),
  serviceId: z.string().uuid("El servicio seleccionado es inválido."),
  employeeId: z.string().uuid("El empleado seleccionado es inválido."),
  date: z.string().regex(LOCAL_DATE_PATTERN, "La fecha seleccionada es inválida."),
  startTimeLocal: z.string().regex(LOCAL_TIME_PATTERN, "La hora de inicio es inválida."),
  notes: z.string().trim().max(500, "Las notas no pueden superar 500 caracteres.").optional().default(""),
  reminderChannels: z.array(z.enum(["email", "sms"])).default([]),
  walkIn: guestWalkInSchema.nullish(),
});

export const createAppointmentSchema = baseAppointmentSchema;
export const updateAppointmentSchema = baseAppointmentSchema.extend({
  status: z.enum(["pending", "confirmed"] satisfies AppointmentStatus[]).optional(),
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().trim().min(4, "Debes indicar el motivo de la cancelación.").max(280, "El motivo no puede superar 280 caracteres."),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(["in_progress", "completed"] satisfies AppointmentStatus[]),
});

export interface AppointmentContext {
  adminClient: ReturnType<typeof createClient<Database>>;
  userId: string;
  role: UserRole;
  profile: ProfileRow;
  organizationId: string;
}

export const resolveOrganizationIdForAppointmentProfile = (
  profile: Pick<ProfileRow, "organization_id">,
): string => {
  if (!profile.organization_id) {
    throw createError({
      statusCode: 403,
      statusMessage: "No se pudo determinar la organizacion asociada para la agenda.",
    });
  }

  return profile.organization_id;
};

const sanitizeNullableString = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
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
      statusMessage: "Falta NUXT_SUPABASE_SERVICE_ROLE_KEY para gestionar citas desde el servidor.",
    });
  }

  return { url, anonKey, serviceRoleKey };
};

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

export const requireAppointmentContext = async (event: H3Event): Promise<AppointmentContext> => {
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
    .select("*")
    .eq("id", authData.user.id)
    .maybeSingle<ProfileRow>();

  if (profileError || !profile || profile.is_active === false) {
    throw createError({
      statusCode: 403,
      statusMessage: "No tienes permisos para gestionar citas.",
    });
  }

  const organizationId = resolveOrganizationIdForAppointmentProfile(profile);

  if (!profile.role) {
    throw createError({
      statusCode: 403,
      statusMessage: "El perfil autenticado no tiene un rol valido para gestionar la agenda.",
    });
  }

  return {
    adminClient,
    userId: profile.id,
    role: profile.role,
    profile: {
      ...profile,
      organization_id: organizationId,
    },
    organizationId,
  };
};

export const assertRoleAccess = (context: AppointmentContext, allowedRoles: UserRole[]) => {
  if (!allowedRoles.includes(context.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: "No tienes permisos para realizar esta acción sobre la agenda.",
    });
  }
};

const toDateFromLocal = (date: string, time: string): Date => {
  return new Date(`${date}T${time}:00`);
};

export const buildAppointmentWindow = (
  date: string,
  startTimeLocal: string,
  durationMinutes: number,
) => {
  const start = toDateFromLocal(date, startTimeLocal);

  if (Number.isNaN(start.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: "La fecha u hora seleccionadas son inválidas.",
    });
  }

  const end = new Date(start.getTime() + durationMinutes * 60_000);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};

export const getAppointmentBranchOrThrow = async (
  context: AppointmentContext,
  branchId: string,
): Promise<BranchRow> => {
  const { data, error } = await context.adminClient
    .from("branches")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", branchId)
    .eq("is_active", true)
    .maybeSingle<BranchRow>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar la sucursal seleccionada.",
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: "La sucursal seleccionada no está disponible en tu organización.",
    });
  }

  return data;
};

export const getAppointmentServiceOrThrow = async (
  context: AppointmentContext,
  serviceId: string,
): Promise<ServiceRow> => {
  const { data, error } = await context.adminClient
    .from("services")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", serviceId)
    .eq("is_active", true)
    .maybeSingle<ServiceRow>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar el servicio seleccionado.",
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: "El servicio seleccionado no está disponible.",
    });
  }

  return data;
};

export const getAppointmentEmployeeOrThrow = async (
  context: AppointmentContext,
  employeeId: string,
): Promise<ProfileRow> => {
  const { data, error } = await context.adminClient
    .from("profiles")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", employeeId)
    .in("role", ["admin", "manager", "employee"] satisfies UserRole[])
    .eq("is_active", true)
    .maybeSingle<ProfileRow>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar al empleado seleccionado.",
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: "El empleado seleccionado no está disponible.",
    });
  }

  return data;
};

const parseServiceSkills = (value: Json | null): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const getEmployeeAssignments = async (
  context: AppointmentContext,
  employeeId: string,
): Promise<AssignmentRow[]> => {
  const { data, error } = await context.adminClient
    .from("employee_branch_assignments")
    .select("*")
    .eq("user_id", employeeId)
    .returns<AssignmentRow[]>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron validar las asignaciones del colaborador.",
    });
  }

  return data ?? [];
};

const resolveUserBranchScope = async (
  context: AppointmentContext,
  userId: string,
): Promise<{ branchIds: Set<string>; primaryBranchId: string | null }> => {
  const { data, error } = await context.adminClient
    .from("employee_branch_assignments")
    .select("branch_id, is_primary")
    .eq("user_id", userId)
    .returns<Array<Pick<AssignmentRow, "branch_id" | "is_primary">>>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron validar las sucursales asignadas del usuario.",
    });
  }

  const branchIds = new Set<string>();
  let primaryBranchId: string | null = null;

  for (const assignment of data ?? []) {
    branchIds.add(assignment.branch_id);
    if (assignment.is_primary && !primaryBranchId) {
      primaryBranchId = assignment.branch_id;
    }
  }

  if (!primaryBranchId) {
    primaryBranchId = (data ?? [])[0]?.branch_id ?? null;
  }

  return { branchIds, primaryBranchId };
};

export const assertEmployeeCanDeliverAppointmentService = async (
  context: AppointmentContext,
  employee: ProfileRow,
  service: ServiceRow,
  branchId: string,
) => {
  const assignments = await getEmployeeAssignments(context, employee.id);
  const assignmentForBranch = assignments.find((assignment) => assignment.branch_id === branchId) ?? null;
  const employeePrimaryBranchId = assignments.find((assignment) => assignment.is_primary)?.branch_id
    ?? null;
  const operatesInBranch = employeePrimaryBranchId === branchId || Boolean(assignmentForBranch);

  if (!operatesInBranch) {
    throw createError({
      statusCode: 409,
      statusMessage: "El colaborador seleccionado no opera en la sucursal indicada.",
    });
  }

  if (!assignmentForBranch) {
    throw createError({
      statusCode: 409,
      statusMessage: "El colaborador no tiene cobertura configurada en esa sucursal.",
    });
  }

  const skills = parseServiceSkills(assignmentForBranch?.skills ?? null);
  if (!skills.includes(service.id)) {
    throw createError({
      statusCode: 409,
      statusMessage: "El colaborador seleccionado no tiene permiso para prestar ese servicio.",
    });
  }
};

export const assertBranchScope = async (
  context: AppointmentContext,
  branchId: string,
) => {
  if (context.role === "admin") {
    return;
  }

  if (context.role === "manager") {
    const managerScope = await resolveUserBranchScope(context, context.userId);
    if (managerScope.primaryBranchId !== branchId) {
      throw createError({
        statusCode: 403,
        statusMessage: "Los managers solo pueden gestionar citas de su sucursal principal.",
      });
    }

    return;
  }

  if (context.role === "employee") {
    const employeeScope = await resolveUserBranchScope(context, context.userId);
    if (!employeeScope.branchIds.has(branchId)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Solo puedes operar sobre citas de tus sucursales asignadas.",
      });
    }
  }
};

export const assertEmployeeSelectionAllowed = (
  context: AppointmentContext,
  employeeId: string,
) => {
  if (context.role === "employee" && context.userId !== employeeId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Solo puedes agendar citas para ti mismo desde tu panel de empleado.",
    });
  }
};

export const assertClientMutationAllowed = (
  context: AppointmentContext,
  appointment: AppointmentRow | null,
) => {
  if (context.role !== "client") {
    return;
  }

  if (appointment && appointment.customer_id !== context.userId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Solo puedes gestionar tus propias citas.",
    });
  }
};

export const validateEmployeeAvailability = async (
  context: AppointmentContext,
  employeeId: string,
  startIso: string,
  endIso: string,
  excludingAppointmentId?: string,
) => {
  let query = context.adminClient
    .from("appointments")
    .select("id, start_time, end_time, status")
    .eq("organization_id", context.organizationId)
    .eq("employee_id", employeeId)
    .in("status", ACTIVE_APPOINTMENT_STATUSES)
    .lt("start_time", endIso)
    .gt("end_time", startIso);

  if (excludingAppointmentId) {
    query = query.neq("id", excludingAppointmentId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar la disponibilidad del empleado.",
    });
  }

  if ((data ?? []).length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "El empleado ya tiene una cita que se solapa con el horario seleccionado.",
    });
  }
};

export const createAppointmentGuestCustomer = async (
  context: AppointmentContext,
  payload: z.output<typeof guestWalkInSchema>,
  branchId: string,
): Promise<GuestCustomerRow> => {
  const { data, error } = await context.adminClient
    .from("guest_customers")
    .insert({
      organization_id: context.organizationId,
      branch_id: branchId,
      created_by: context.userId,
      full_name: payload.fullName.trim(),
      phone: sanitizeNullableString(payload.phone),
      notes: sanitizeNullableString(payload.notes),
    })
    .select("*")
    .single<GuestCustomerRow>();

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo registrar el cliente temporal del walk-in.",
    });
  }

  return data;
};

export const getAppointmentOrThrow = async (
  context: AppointmentContext,
  appointmentId: string,
): Promise<AppointmentRow> => {
  const { data, error } = await context.adminClient
    .from("appointments")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", appointmentId)
    .maybeSingle<AppointmentRow>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo cargar la cita solicitada.",
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: "La cita solicitada no existe o ya no está disponible.",
    });
  }

  return data;
};

export const assertAppointmentMutationScope = async (
  context: AppointmentContext,
  appointment: AppointmentRow,
) => {
  if (context.role === "admin") {
    return;
  }

  if (context.role === "manager") {
    const managerScope = await resolveUserBranchScope(context, context.userId);
    if (appointment.branch_id !== managerScope.primaryBranchId) {
      throw createError({
        statusCode: 403,
        statusMessage: "Los managers solo pueden gestionar citas de su sucursal.",
      });
    }

    return;
  }

  if (context.role === "employee") {
    if (appointment.employee_id !== context.userId) {
      throw createError({
        statusCode: 403,
        statusMessage: "Solo puedes gestionar citas asignadas a tu agenda.",
      });
    }

    return;
  }

  assertClientMutationAllowed(context, appointment);
};

export const insertAuditLog = async (
  context: AppointmentContext,
  payload: {
    recordId: string;
    action: Database["public"]["Enums"]["audit_action"];
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
    event: string;
    extraContext?: Record<string, unknown>;
  },
) => {
  const auditPayload: Database["public"]["Tables"]["audit_logs"]["Insert"] = {
    user_id: context.userId,
    action: payload.action,
    table_name: "appointments",
    record_id: payload.recordId,
    old_data: (payload.oldData ?? null) as Json,
    new_data: (payload.newData ?? null) as Json,
    context: {
      event: payload.event,
      organization_id: context.organizationId,
      role: context.role,
      ...(payload.extraContext ?? {}),
    },
  };

  await context.adminClient.from("audit_logs").insert(auditPayload);
};

export const readValidatedAppointmentBody = async <T>(event: H3Event, schema: z.ZodSchema<T>): Promise<T> => {
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

export const mapAppointmentMutationError = (error: unknown, fallbackMessage: string): never => {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const isOverlap = typeof message === "string" && (
    message.includes("solapa")
    || message.includes("appointments_no_overlap_per_employee")
    || message.includes("conflicting key value")
  );

  throw createError({
    statusCode: isOverlap ? 409 : 500,
    statusMessage: isOverlap
      ? "El empleado ya tiene una cita que se solapa con el horario seleccionado."
      : message,
  });
};
