import { createError } from "h3";
import { z } from "zod";

import { resolveOrLinkClient } from "../clientLinking";
import { resolveAuthUserId, resolveServerAuthenticatedUser } from "../../utils/auth-server";
import { buildAppointmentWindow } from "../../utils/appointments";
import { sendAppointmentConfirmationNotification } from "../../utils/notifications";

import { buildPublicAdminClient } from "./client";

import type { H3Event } from "h3";
import type { Database } from "@/types/database.types";
import type {
  PublicBookingAvailabilityResponse,
  PublicBookingCatalogResponse,
  PublicBookingClientLinkPayload,
  PublicBookingClientProfile,
  PublicBookingCreateResponse,
  PublicBookingSlot,
} from "@/types/public-booking";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type StorefrontSettingsRow = Database["public"]["Tables"]["organization_storefront_settings"]["Row"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type PublicProfileRole = Database["public"]["Tables"]["profiles"]["Row"]["role"];

const PUBLIC_BOOKING_LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PUBLIC_BOOKING_LOCAL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ACTIVE_STATUSES: Array<Database["public"]["Enums"]["appointment_status"]> = ["pending", "confirmed", "in_progress"];

const publicBookingSchema = z.object({
  branchId: z.string().uuid(),
  serviceId: z.string().uuid(),
  employeeId: z.string().uuid(),
  date: z.string().regex(PUBLIC_BOOKING_LOCAL_DATE, "La fecha es invalida."),
  startTimeLocal: z.string().regex(PUBLIC_BOOKING_LOCAL_TIME, "La hora es invalida."),
  fullName: z.string().trim().min(3, "El nombre es obligatorio.").nullable().optional(),
  phone: z.string().trim().min(7, "El telefono es obligatorio.").nullable().optional(),
  email: z.string().trim().email("El correo es invalido.").nullable().optional(),
  notes: z.string().trim().max(500, "La nota no puede exceder 500 caracteres.").nullable().optional(),
});

const publicBookingClientLinkSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  lastName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().min(7, "Debes enviar al menos phone o email.").max(30).optional().nullable(),
  email: z.string().trim().email("El correo es invalido.").optional().nullable(),
  billingData: z.record(z.string(), z.unknown()).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (!value.phone?.trim() && !value.email?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debes enviar al menos phone o email.",
      path: ["phone"],
    });
  }
});

const normalizeSlug = (slug: string) => slug.trim().toLowerCase();

const sanitizeNullable = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const normalizeFullName = (user: Awaited<ReturnType<typeof resolveServerAuthenticatedUser>>) => {
  const fromMetadata = typeof user?.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name.trim()
    : typeof user?.user_metadata?.name === "string"
      ? user.user_metadata.name.trim()
      : "";

  if (fromMetadata.length > 0) {
    return fromMetadata;
  }

  const email = typeof user?.email === "string" ? user.email.trim() : "";
  const localPart = email.split("@")[0]?.replace(/[._-]+/g, " ").trim() ?? "";
  return localPart.length > 0 ? localPart : "Cliente";
};

const readJsonString = (value: OrganizationRow["billing_data"], key: string): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : null;
};

const parseSkills = (skills: AssignmentRow["skills"]): string[] => {
  if (!Array.isArray(skills)) {
    return [];
  }

  return skills.filter((value): value is string => typeof value === "string");
};

const getPublicStorefrontContext = async (event: H3Event, slug: string) => {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) {
    throw createError({ statusCode: 400, statusMessage: "Slug invalido." });
  }

  const adminClient = buildPublicAdminClient(event);

  const { data: organization, error: organizationError } = await adminClient
    .from("organizations")
    .select("id, name, slug, timezone, billing_data, is_active, status")
    .eq("slug", normalizedSlug)
    .eq("is_active", true)
    .maybeSingle<OrganizationRow>();

  if (organizationError) {
    throw createError({ statusCode: 500, statusMessage: organizationError.message });
  }

  if (!organization || organization.status !== "active") {
    throw createError({ statusCode: 404, statusMessage: "No encontramos esta organizacion." });
  }

  const { data: settings, error: settingsError } = await adminClient
    .from("organization_storefront_settings")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("is_published", true)
    .maybeSingle<StorefrontSettingsRow>();

  if (settingsError) {
    throw createError({ statusCode: 500, statusMessage: settingsError.message });
  }

  if (!settings || settings.business_type !== "service") {
    throw createError({ statusCode: 404, statusMessage: "La tienda no tiene reservas publicas disponibles." });
  }

  return {
    adminClient,
    organization,
    settings,
  };
};

const getWorkingHours = (organization: OrganizationRow) => {
  const start = readJsonString(organization.billing_data, "booking_start") ?? "09:00";
  const end = readJsonString(organization.billing_data, "booking_end") ?? "20:00";
  return { start, end };
};

const dateToParts = (value: string) => {
  const parts = value.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw createError({ statusCode: 400, statusMessage: "La fecha es invalida." });
  }

  return { year, month, day };
};

const combineLocalDateTime = (date: string, time: string) => {
  const { year, month, day } = dateToParts(date);
  const parts = time.split(":");
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    throw createError({ statusCode: 400, statusMessage: "La hora es invalida." });
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
};

const getCategoryMap = async (event: H3Event, organizationId: string) => {
  const adminClient = buildPublicAdminClient(event);
  const { data, error } = await adminClient
    .from("categories")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("type", "service")
    .returns<Array<Pick<CategoryRow, "id" | "name">>>();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return new Map((data ?? []).map((row) => [row.id, row.name]));
};

const getEmployeeAssignmentsMap = async (
  adminClient: ReturnType<typeof buildPublicAdminClient>,
  employeeIds: string[],
) => {
  const { data, error } = await adminClient
    .from("employee_branch_assignments")
    .select("user_id, branch_id, skills")
    .in("user_id", employeeIds)
    .returns<Array<Pick<AssignmentRow, "user_id" | "branch_id" | "skills">>>();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  const assignmentsByEmployee = new Map<string, Array<Pick<AssignmentRow, "user_id" | "branch_id" | "skills">>>();
  for (const row of data ?? []) {
    const current = assignmentsByEmployee.get(row.user_id) ?? [];
    current.push(row);
    assignmentsByEmployee.set(row.user_id, current);
  }
  return assignmentsByEmployee;
};

const isStaffProfileRole = (role: PublicProfileRole | null | undefined): boolean => {
  return role === "admin" || role === "manager" || role === "employee";
};

const resolveAuthenticatedStaffConflict = async (
  adminClient: ReturnType<typeof buildPublicAdminClient>,
  userId: string,
) => {
  const { data: profile, error } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<Pick<ProfileRow, "role">>();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return isStaffProfileRole(profile?.role) ? (profile?.role ?? null) : null;
};

const resolveAuthenticatedClientContext = async (
  event: H3Event,
  adminClient: ReturnType<typeof buildPublicAdminClient>,
  organizationId: string,
) => {
  const authUser = await resolveServerAuthenticatedUser(event);
  const authUserId = resolveAuthUserId(authUser);

  if (!authUser || !authUserId) {
    return null;
  }

  const staffRole = await resolveAuthenticatedStaffConflict(adminClient, authUserId);
  if (staffRole) {
    return {
      clientId: authUserId,
      customerName: normalizeFullName(authUser),
      customerPhone: null,
      customerEmail: authUser.email ?? null,
      orgStatus: "blocked" as const,
    };
  }

  const { data: client, error: clientError } = await adminClient
    .from("clients")
    .select("id, first_name, last_name, phone, email")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (clientError) {
    throw createError({ statusCode: 500, statusMessage: clientError.message });
  }

  if (!client) {
    return null;
  }

  const { data: clientOrg, error: clientOrgError } = await adminClient
    .from("client_org")
    .select("status")
    .eq("client_id", client.id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (clientOrgError) {
    throw createError({ statusCode: 500, statusMessage: clientOrgError.message });
  }

  if (!clientOrg) {
    return null;
  }

  if (clientOrg.status !== "active") {
    return {
      clientId: client.id,
      customerName: [client.first_name, client.last_name].filter(Boolean).join(" ").trim() || normalizeFullName(authUser),
      customerPhone: client.phone,
      customerEmail: client.email,
      orgStatus: clientOrg.status as "active" | "inactive" | "blocked",
    };
  }

  const fullName = [client.first_name, client.last_name].filter(Boolean).join(" ").trim() || authUser.email || "Cliente";

  return {
    clientId: client.id,
    customerName: fullName,
    customerPhone: client.phone,
    customerEmail: client.email,
    orgStatus: clientOrg.status as "active" | "inactive" | "blocked",
  };
};

const toPublicBookingClientProfile = (client: {
  clientId: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  orgStatus: "active" | "inactive" | "blocked";
}): PublicBookingClientProfile => ({
  clientId: client.clientId,
  fullName: client.customerName,
  phone: client.customerPhone,
  email: client.customerEmail,
  orgStatus: client.orgStatus,
});

export async function linkPublicBookingClientBySlug(
  event: H3Event,
  slug: string,
  body: PublicBookingClientLinkPayload,
): Promise<PublicBookingClientProfile> {
  const { adminClient, organization } = await getPublicStorefrontContext(event, slug);
  const parsedBody = publicBookingClientLinkSchema.safeParse(body);

  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsedBody.error.issues[0]?.message ?? "Solicitud invalida.",
    });
  }

  const authUser = await resolveServerAuthenticatedUser(event);
  const authUserId = resolveAuthUserId(authUser);

  if (!authUser || !authUserId) {
    throw createError({ statusCode: 401, statusMessage: "Debes iniciar sesion para vincular tu perfil." });
  }

  const staffRole = await resolveAuthenticatedStaffConflict(adminClient, authUserId);
  if (staffRole) {
    throw createError({
      statusCode: 403,
      statusMessage: "Esta cuenta no tiene acceso como cliente a esta tienda.",
    });
  }

  const payload = parsedBody.data;
  const linked = await resolveOrLinkClient(adminClient, {
    organizationId: organization.id,
    userId: authUserId,
    firstName: payload.firstName,
    lastName: sanitizeNullable(payload.lastName),
    phone: sanitizeNullable(payload.phone),
    email: sanitizeNullable(payload.email) ?? authUser.email ?? null,
    billingData: payload.billingData,
    preferences: payload.preferences,
  });

  return toPublicBookingClientProfile({
    clientId: linked.client.id,
    customerName: [linked.client.first_name, linked.client.last_name].filter(Boolean).join(" ").trim() || payload.firstName,
    customerPhone: linked.client.phone,
    customerEmail: linked.client.email,
    orgStatus: linked.orgStatus as "active" | "inactive" | "blocked",
  });
}

export async function getPublicBookingClientProfileBySlug(
  event: H3Event,
  slug: string,
): Promise<PublicBookingClientProfile | null> {
  const { adminClient, organization } = await getPublicStorefrontContext(event, slug);
  const authenticatedClient = await resolveAuthenticatedClientContext(event, adminClient, organization.id);

  if (!authenticatedClient) {
    return null;
  }

  return {
    ...toPublicBookingClientProfile(authenticatedClient),
  };
}

export async function getPublicBookingCatalogBySlug(
  event: H3Event,
  slug: string,
): Promise<PublicBookingCatalogResponse> {
  const { adminClient, organization } = await getPublicStorefrontContext(event, slug);

  const [
    { data: branches, error: branchesError },
    { data: services, error: servicesError },
    { data: employees, error: employeesError },
  ] = await Promise.all([
    adminClient
      .from("branches")
      .select("id, name, address")
      .eq("organization_id", organization.id)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<Array<Pick<BranchRow, "id" | "name" | "address">>>(),
    adminClient
      .from("services")
      .select("id, name, description, duration_minutes, price, category_id")
      .eq("organization_id", organization.id)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<Array<Pick<ServiceRow, "id" | "name" | "description" | "duration_minutes" | "price" | "category_id">>>(),
    adminClient
      .from("profiles")
      .select("id, full_name, role")
      .eq("organization_id", organization.id)
      .eq("is_active", true)
      .in("role", ["manager", "employee"])
      .order("full_name", { ascending: true })
      .returns<Array<Pick<ProfileRow, "id" | "full_name" | "role">>>(),
  ]);

  const firstError = branchesError ?? servicesError ?? employeesError;
  if (firstError) {
    throw createError({ statusCode: 500, statusMessage: firstError.message });
  }

  const employeeIds = (employees ?? []).map((employee) => employee.id);
  const assignmentsByEmployee = await getEmployeeAssignmentsMap(adminClient, employeeIds);
  const categoryMap = await getCategoryMap(event, organization.id);

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    timeZone: organization.timezone ?? "America/La_Paz",
    branches: (branches ?? []).map((branch) => ({
      id: branch.id,
      name: branch.name,
      address: branch.address,
    })),
    services: (services ?? []).map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      durationMinutes: service.duration_minutes,
      price: service.price,
      categoryName: service.category_id ? (categoryMap.get(service.category_id) ?? null) : null,
    })),
    employees: (employees ?? [])
      .map((employee) => {
        const assignments = assignmentsByEmployee.get(employee.id) ?? [];
        const serviceIdsByBranch = Object.fromEntries(assignments.map((assignment) => [
          assignment.branch_id,
          parseSkills(assignment.skills),
        ]));
        const assignedBranchIds = assignments.map((assignment) => assignment.branch_id);
        return {
          id: employee.id,
          fullName: employee.full_name,
          role: employee.role ?? "employee",
          assignedBranchIds,
          serviceIdsByBranch,
        };
      })
      .filter((employee) => employee.assignedBranchIds.length > 0),
  };
}

const ensureEmployeeCanServe = async (
  adminClient: ReturnType<typeof buildPublicAdminClient>,
  organizationId: string,
  employeeId: string,
  branchId: string,
  serviceId: string,
) => {
  const { data: employee, error: employeeError } = await adminClient
    .from("profiles")
    .select("id, full_name, role, organization_id, is_active")
    .eq("id", employeeId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle<ProfileRow>();

  if (employeeError) {
    throw createError({ statusCode: 500, statusMessage: employeeError.message });
  }

  if (!employee) {
    throw createError({ statusCode: 404, statusMessage: "El profesional no esta disponible." });
  }

  const { data: assignment, error: assignmentError } = await adminClient
    .from("employee_branch_assignments")
    .select("user_id, branch_id, skills")
    .eq("user_id", employeeId)
    .eq("branch_id", branchId)
    .maybeSingle<Pick<AssignmentRow, "user_id" | "branch_id" | "skills">>();

  if (assignmentError) {
    throw createError({ statusCode: 500, statusMessage: assignmentError.message });
  }

  const supportedServiceIds = parseSkills(assignment?.skills ?? null);
  if (!assignment || !supportedServiceIds.includes(serviceId)) {
    throw createError({ statusCode: 409, statusMessage: "El profesional no cubre ese servicio en la sucursal seleccionada." });
  }

  return employee;
};

const getConflictingAppointments = async (
  adminClient: ReturnType<typeof buildPublicAdminClient>,
  organizationId: string,
  employeeId: string,
  startIso: string,
  endIso: string,
) => {
  const { data, error } = await adminClient
    .from("appointments")
    .select("id, start_time, end_time")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .in("status", ACTIVE_STATUSES)
    .lt("start_time", endIso)
    .gt("end_time", startIso)
    .returns<Array<Pick<AppointmentRow, "id" | "start_time" | "end_time">>>();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return data ?? [];
};

const getEmployeeDayAppointments = async (
  adminClient: ReturnType<typeof buildPublicAdminClient>,
  organizationId: string,
  employeeId: string,
  dayStartIso: string,
  dayEndIso: string,
) => {
  const { data, error } = await adminClient
    .from("appointments")
    .select("id, start_time, end_time")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .in("status", ACTIVE_STATUSES)
    .gte("start_time", dayStartIso)
    .lt("start_time", dayEndIso)
    .returns<Array<Pick<AppointmentRow, "id" | "start_time" | "end_time">>>();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return data ?? [];
};

export async function getPublicBookingAvailabilityBySlug(
  event: H3Event,
  slug: string,
  query: {
    branchId: string;
    serviceId: string;
    employeeId: string;
    date: string;
  },
): Promise<PublicBookingAvailabilityResponse> {
  const { adminClient, organization } = await getPublicStorefrontContext(event, slug);

  if (!PUBLIC_BOOKING_LOCAL_DATE.test(query.date)) {
    throw createError({ statusCode: 400, statusMessage: "La fecha es invalida." });
  }

  const { data: branch, error: branchError } = await adminClient
    .from("branches")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("id", query.branchId)
    .eq("is_active", true)
    .maybeSingle<Pick<BranchRow, "id">>();

  if (branchError) {
    throw createError({ statusCode: 500, statusMessage: branchError.message });
  }

  if (!branch) {
    throw createError({ statusCode: 404, statusMessage: "La sucursal no esta disponible." });
  }

  const { data: service, error: serviceError } = await adminClient
    .from("services")
    .select("id, duration_minutes")
    .eq("organization_id", organization.id)
    .eq("id", query.serviceId)
    .eq("is_active", true)
    .maybeSingle<Pick<ServiceRow, "id" | "duration_minutes">>();

  if (serviceError) {
    throw createError({ statusCode: 500, statusMessage: serviceError.message });
  }

  if (!service) {
    throw createError({ statusCode: 404, statusMessage: "El servicio no esta disponible." });
  }

  await ensureEmployeeCanServe(adminClient, organization.id, query.employeeId, query.branchId, query.serviceId);

  const { start: openingTime, end: closingTime } = getWorkingHours(organization);
  const openingDate = combineLocalDateTime(query.date, openingTime);
  const closingDate = combineLocalDateTime(query.date, closingTime);
  const now = new Date();
  const dayOfWeek = combineLocalDateTime(query.date, openingTime).getDay();

  if (dayOfWeek === 0) {
    return { date: query.date, slots: [] };
  }

  const slots: PublicBookingSlot[] = [];
  const stepMinutes = 30;
  const dayAppointments = await getEmployeeDayAppointments(
    adminClient,
    organization.id,
    query.employeeId,
    openingDate.toISOString(),
    closingDate.toISOString(),
  );

  for (let cursor = new Date(openingDate); cursor.getTime() + service.duration_minutes * 60_000 <= closingDate.getTime(); cursor = new Date(cursor.getTime() + stepMinutes * 60_000)) {
    const hours = String(cursor.getHours()).padStart(2, "0");
    const minutes = String(cursor.getMinutes()).padStart(2, "0");
    const value = `${hours}:${minutes}`;
    const { startIso, endIso } = buildAppointmentWindow(query.date, value, service.duration_minutes);
    const available = !dayAppointments.some((appointment) =>
      appointment.start_time < endIso && appointment.end_time > startIso,
    ) && cursor.getTime() > now.getTime();
    slots.push({
      label: value,
      value,
      available,
    });
  }

  return {
    date: query.date,
    slots,
  };
}

export async function createPublicBookingBySlug(
  event: H3Event,
  slug: string,
  body: unknown,
): Promise<PublicBookingCreateResponse> {
  const { adminClient, organization } = await getPublicStorefrontContext(event, slug);
  const parsedBody = publicBookingSchema.safeParse(body);

  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsedBody.error.issues[0]?.message ?? "Solicitud invalida.",
    });
  }

  const payload = parsedBody.data;
  const authenticatedClient = await resolveAuthenticatedClientContext(event, adminClient, organization.id);
  if (!authenticatedClient || authenticatedClient.orgStatus !== "active") {
    throw createError({ statusCode: 401, statusMessage: "Debes iniciar sesion o registrarte para agendar." });
  }
  const resolvedAuthenticatedClient = authenticatedClient;

  const { data: branch, error: branchError } = await adminClient
    .from("branches")
    .select("id, name")
    .eq("organization_id", organization.id)
    .eq("id", payload.branchId)
    .eq("is_active", true)
    .maybeSingle<Pick<BranchRow, "id" | "name">>();

  if (branchError) {
    throw createError({ statusCode: 500, statusMessage: branchError.message });
  }

  if (!branch) {
    throw createError({ statusCode: 404, statusMessage: "La sucursal seleccionada no existe." });
  }

  const { data: service, error: serviceError } = await adminClient
    .from("services")
    .select("id, name, duration_minutes")
    .eq("organization_id", organization.id)
    .eq("id", payload.serviceId)
    .eq("is_active", true)
    .maybeSingle<Pick<ServiceRow, "id" | "name" | "duration_minutes">>();

  if (serviceError) {
    throw createError({ statusCode: 500, statusMessage: serviceError.message });
  }

  if (!service) {
    throw createError({ statusCode: 404, statusMessage: "El servicio seleccionado no existe." });
  }

  const employee = await ensureEmployeeCanServe(adminClient, organization.id, payload.employeeId, payload.branchId, payload.serviceId);
  const { startIso, endIso } = buildAppointmentWindow(payload.date, payload.startTimeLocal, service.duration_minutes);
  const conflicts = await getConflictingAppointments(adminClient, organization.id, payload.employeeId, startIso, endIso);

  if (conflicts.length > 0) {
    throw createError({ statusCode: 409, statusMessage: "El horario ya no esta disponible. Elige otro bloque." });
  }

  const customerId = resolvedAuthenticatedClient.clientId;
  const customerName = resolvedAuthenticatedClient.customerName;
  const customerPhone = resolvedAuthenticatedClient.customerPhone;

  const { data: appointment, error: appointmentError } = await adminClient
    .from("appointments")
    .insert({
      organization_id: organization.id,
      branch_id: branch.id,
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      employee_id: employee.id,
      service_id: service.id,
      start_time: startIso,
      end_time: endIso,
      status: "pending",
      source: "client_booking",
      notes: payload.notes?.trim() || null,
    })
    .select("id, start_time")
    .single<Pick<AppointmentRow, "id" | "start_time">>();

  if (appointmentError || !appointment) {
    throw createError({ statusCode: 500, statusMessage: appointmentError?.message ?? "No se pudo crear la reserva." });
  }

  if (customerPhone) {
    sendAppointmentConfirmationNotification({
      organizationId: organization.id,
      customerName,
      customerPhone,
      serviceName: service.name,
      date: new Intl.DateTimeFormat("es-BO", { dateStyle: "full" }).format(new Date(startIso)),
      time: new Intl.DateTimeFormat("es-BO", { timeStyle: "short" }).format(new Date(startIso)),
      employeeName: employee.full_name ?? "Profesional",
      appointmentId: appointment.id,
    }).catch((error) => {
      console.error("[PublicBooking] confirmation notification failed:", error);
    });
  }

  return {
    success: true,
    appointmentId: appointment.id,
    status: "pending",
    customerName,
    serviceName: service.name,
    employeeName: employee.full_name ?? "Profesional",
    startTime: appointment.start_time,
  };
}
