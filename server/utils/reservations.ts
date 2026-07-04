import { createClient } from "@supabase/supabase-js";
import { createError, getHeader, readBody } from "h3";
import { z } from "zod";

import type { H3Event } from "h3";
import type { Database } from "@/types/database.types";
import { assertTenantModuleAccess, type TenantModuleAction } from "./tenant-module-access";

type UserRole = Database["public"]["Enums"]["user_role"];
type AdminClient = ReturnType<typeof createClient<Database>>;

const numericField = z.coerce.number().finite();

export const createReservationSchema = z.object({
  branchId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha invalido (YYYY-MM-DD)."),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha invalido (YYYY-MM-DD)."),
  openEnded: z.boolean().optional().default(false),
  rooms: z.array(z.object({
    roomId: z.string().uuid(),
    notes: z.string().trim().max(500).optional().default(""),
    guests: z.array(z.object({
      fullName: z.string().trim().min(1, "El nombre del huesped es obligatorio."),
      documentType: z.string().trim().min(1, "El tipo de documento es obligatorio."),
      documentNumber: z.string().trim().min(1, "El numero de documento es obligatorio."),
      birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha invalido (YYYY-MM-DD)."),
      sex: z.enum(["male", "female", "other"]),
      phone: z.string().trim().optional().or(z.literal("")).default(""),
      email: z.string().trim().email("Email invalido.").optional().or(z.literal("")).default(""),
      nationality: z.string().trim().max(120).optional().default(""),
      address: z.string().trim().max(240).optional().default(""),
      maritalStatus: z.string().trim().max(80).optional().default(""),
      isMainGuest: z.boolean().default(false),
    })).min(1, "Cada habitacion debe tener al menos un huesped principal."),
  })).min(1, "Debe seleccionar al menos una habitacion."),
  notes: z.string().trim().max(500).optional().default(""),
  payment: z.object({
    amount: numericField.min(0.01, "El monto debe ser mayor a cero."),
    paymentMethod: z.enum(["cash", "card", "transfer", "qr", "digital_wallet"]),
    paymentType: z.enum(["deposit", "balance", "full"]),
    reference: z.string().trim().optional().default(""),
    notes: z.string().trim().max(500).optional().default(""),
  }).optional(),
}).refine((data) => new Date(data.checkOut) > new Date(data.checkIn), {
  message: "La fecha de salida debe ser posterior a la de entrada.",
}).superRefine((data, ctx) => {
  data.rooms.forEach((room, roomIndex) => {
    const mainGuestCount = room.guests.filter((guest) => guest.isMainGuest).length;
    if (mainGuestCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rooms", roomIndex, "guests"],
        message: "Cada habitación debe tener exactamente un huésped principal.",
      });
    }
  });
});

export const updateReservationSchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const reservationStayActionSchema = z.object({
  action: z.enum(["check_in", "check_out", "complete_stay", "extend_stay"]),
  openEnded: z.boolean().optional(),
  effectiveCheckOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha invalido (YYYY-MM-DD).").optional(),
  notes: z.string().trim().max(500).optional().default(""),
}).superRefine((data, ctx) => {
  if (data.action === "extend_stay" && data.openEnded !== true && !data.effectiveCheckOut) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["effectiveCheckOut"],
      message: "La nueva fecha de salida es obligatoria.",
    });
  }
});

export const cancelReservationSchema = z.object({
  reason: z.string().trim().min(1, "El motivo de cancelacion es obligatorio."),
});

export const createPaymentSchema = z.object({
  reservationId: z.string().uuid(),
  amount: numericField.min(0.01, "El monto debe ser mayor a cero."),
  paymentMethod: z.enum(["cash", "card", "transfer", "qr", "digital_wallet"]),
  paymentType: z.enum(["deposit", "balance", "full"]),
  reference: z.string().trim().optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});

export interface ReservationContext {
  adminClient: AdminClient;
  userId: string;
  role: UserRole;
  organizationId: string;
  roleId: string | null;
  allowedBranchIds: string[];
}

const getBearerToken = (event: H3Event): string => {
  const header = getHeader(event, "authorization");
  if (!header?.startsWith("Bearer ")) {
    throw createError({ statusCode: 401, statusMessage: "Token de autenticacion requerido." });
  }
  return header.slice("Bearer ".length);
};

export const requireReservationContext = async (event: H3Event): Promise<ReservationContext> => {
  const config = useRuntimeConfig(event);
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = config.supabaseServiceRoleKey as string | undefined;

  if (!url || !anonKey || !serviceRoleKey) {
    throw createError({ statusCode: 500, statusMessage: "Configuracion de Supabase incompleta." });
  }

  const token = getBearerToken(event);
  const authClient = createClient<Database, "public">(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: "Sesion no valida." });
  }

  const adminClient = createClient<Database, "public">(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, organization_id, role, role_id, is_active")
    .eq("id", authData.user.id)
    .maybeSingle<{ id: string; organization_id: string; role: UserRole; role_id: string | null; is_active: boolean }>();

  if (profileError || !profile?.organization_id || profile.is_active === false) {
    throw createError({ statusCode: 403, statusMessage: "Perfil no valido para gestionar reservas." });
  }

  let allowedBranchIds: string[] = [];
  if (profile.role === "admin") {
    const { data: branches, error: branchesError } = await adminClient
      .from("branches")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true);

    if (branchesError) {
      throw createError({ statusCode: 500, statusMessage: "No se pudieron cargar las sucursales del usuario." });
    }

    allowedBranchIds = (branches ?? []).map((branch) => branch.id);
  } else if (profile.role === "manager" || profile.role === "employee") {
    const { data: assignments, error: assignmentsError } = await adminClient
      .from("employee_branch_assignments")
      .select("branch_id")
      .eq("user_id", profile.id);

    if (assignmentsError) {
      throw createError({ statusCode: 500, statusMessage: "No se pudieron cargar las sucursales asignadas." });
    }

    allowedBranchIds = Array.from(new Set((assignments ?? []).map((assignment) => assignment.branch_id)));
  } else {
    throw createError({ statusCode: 403, statusMessage: "No tienes permisos para gestionar reservas." });
  }

  return {
    adminClient,
    userId: profile.id,
    role: profile.role,
    organizationId: profile.organization_id,
    roleId: profile.role_id,
    allowedBranchIds,
  };
};

export const requireReservationContextStrict = async (
  event: H3Event,
  action: TenantModuleAction = "can_view",
): Promise<ReservationContext> => {
  const context = await requireReservationContext(event);

  await assertTenantModuleAccess({
    adminClient: context.adminClient,
    organizationId: context.organizationId,
    role: context.role,
    roleId: context.roleId,
    moduleKey: "reservations",
    action,
  });

  return context;
};

export const assertReservationModuleAccess = async (
  context: ReservationContext,
  action: TenantModuleAction,
) => {
  await assertTenantModuleAccess({
    adminClient: context.adminClient,
    organizationId: context.organizationId,
    role: context.role,
    roleId: context.roleId,
    moduleKey: "reservations",
    action,
  });
};

export const readValidatedReservationBody = async <T>(event: H3Event, schema: z.ZodSchema<T>): Promise<T> => {
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

export const getReservationOrThrow = async (context: ReservationContext, reservationId: string) => {
  const { data, error } = await context.adminClient
    .from("reservations")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", reservationId)
    .maybeSingle();

  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  if (!data) throw createError({ statusCode: 404, statusMessage: "Reserva no encontrada." });
  if (!context.allowedBranchIds.includes(data.branch_id)) {
    throw createError({ statusCode: 403, statusMessage: "No tienes acceso a esta reserva." });
  }
  return data;
};

export const assertReservationBranchAccess = (context: ReservationContext, branchId: string) => {
  if (!context.allowedBranchIds.includes(branchId)) {
    throw createError({ statusCode: 403, statusMessage: "No tienes acceso a esta sucursal." });
  }
};
