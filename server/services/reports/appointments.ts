import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import type { ReportsResolvedContext, ReportBranchOption, ReportEmployeeOption, ReportCategoryOption } from "./context";

import type { H3Event } from "h3";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

const DEFAULT_WORKDAY_MINUTES = 8 * 60;
const startOfDayIso = (value: string) => new Date(`${value}T00:00:00`).toISOString();
const endOfDayIso = (value: string) => new Date(`${value}T23:59:59.999`).toISOString();

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  in_progress: "En proceso",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistio",
};

const getSupabaseServerConfig = (event: H3Event) => {
  const config = useRuntimeConfig(event);
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = config.supabaseServiceRoleKey as string | undefined;

  if (!url || !anonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "La configuracion publica de Supabase esta incompleta.",
    });
  }

  if (!serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Falta NUXT_SUPABASE_SERVICE_ROLE_KEY para generar reportes desde el servidor.",
    });
  }

  return { url, anonKey, serviceRoleKey };
};

const formatInteger = (value: number) => new Intl.NumberFormat("es-BO").format(value);
const formatPercent = (value: number) =>
  new Intl.NumberFormat("es-BO", { style: "percent", maximumFractionDigits: 1 }).format(value);
const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export interface ReportsAppointmentsResult {
  kpis: Array<{ label: string; value: string; tone?: string; meta?: string }>;
  statusBreakdown: Array<{ label: string; value: number }>;
  employeeOccupancy: Array<{ label: string; value: number; meta?: string }>;
  serviceDemand: Array<{ label: string; value: number }>;
  tableRows: Array<Record<string, string | number>>;
  filterOptions: {
    branches: ReportBranchOption[];
    employees: ReportEmployeeOption[];
    productCategories: ReportCategoryOption[];
    serviceCategories: ReportCategoryOption[];
    paymentMethods: Array<{ label: string; value: string }>;
  };
}

export async function getReportsAppointments(
  event: H3Event,
  context: ReportsResolvedContext,
  filters: { startDate: string; endDate: string; branchIds: string[]; employeeId: string | null; paymentMethod: string; categoryIds: string[] },
  filterOptions: ReportsAppointmentsResult["filterOptions"],
): Promise<ReportsAppointmentsResult> {
  const { url, serviceRoleKey } = getSupabaseServerConfig(event);
  const adminClient = createClient<Database, "public">(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const scopedBranchIds = context.role === "manager"
    ? context.branchIds
    : filters.branchIds.length === 0
      ? context.branchIds
      : context.branchIds.filter((branchId) => filters.branchIds.includes(branchId));

  let query = adminClient
    .from("appointments")
    .select("id, branch_id, employee_id, service_id, status, start_time, end_time")
    .eq("organization_id", context.organizationId)
    .in("branch_id", scopedBranchIds)
    .gte("start_time", startOfDayIso(filters.startDate))
    .lte("start_time", endOfDayIso(filters.endDate))
    .order("start_time", { ascending: false });

  if (filters.employeeId) {
    query = query.eq("employee_id", filters.employeeId);
  }

  const { data, error } = await query.returns<Pick<AppointmentRow, "id" | "branch_id" | "employee_id" | "service_id" | "status" | "start_time" | "end_time">[]>();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  const appointments = data ?? [];
  const serviceIds = Array.from(new Set(appointments.map((a) => a.service_id)));
  let servicesById = new Map<string, ServiceRow>();
  if (serviceIds.length > 0) {
    const { data: services, error: servicesError } = await adminClient
      .from("services")
      .select("*")
      .eq("organization_id", context.organizationId)
      .in("id", serviceIds)
      .returns<ServiceRow[]>();

    if (servicesError) {
      throw createError({ statusCode: 500, statusMessage: servicesError.message });
    }

    servicesById = new Map((services ?? []).map((s) => [s.id, s]));
  }

  const filteredAppointments = appointments.filter((appointment) => {
    const service = servicesById.get(appointment.service_id);
    if (!service) {
      return false;
    }

    if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(service.category_id ?? "")) {
      return false;
    }

    return true;
  });

  const totalAppointments = filteredAppointments.length;
  const dayCount = Math.max(
    1,
    Math.ceil((new Date(`${filters.endDate}T23:59:59`).getTime() - new Date(`${filters.startDate}T00:00:00`).getTime()) / (24 * 60 * 60 * 1000)),
  );

  const statusBreakdown = Array.from(filteredAppointments.reduce<Map<string, number>>((acc, a) => {
    const key = a.status ?? "pending";
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map())).map(([status, value]) => ({
    label: APPOINTMENT_STATUS_LABELS[status] ?? status,
    value,
  }));

  const employeeLabelMap = new Map(filterOptions.employees.map((e) => [e.value, e.label]));
  const branchLabelMap = new Map(filterOptions.branches.map((b) => [b.value, b.label]));

  const employeeOccupancy = Array.from(filteredAppointments.reduce<Map<string, number>>((acc, a) => {
    const start = new Date(a.start_time).getTime();
    const end = new Date(a.end_time).getTime();
    const durationMinutes = Math.max(0, Math.round((end - start) / (1000 * 60)));
    acc.set(a.employee_id, (acc.get(a.employee_id) ?? 0) + durationMinutes);
    return acc;
  }, new Map())).map(([employeeId, bookedMinutes]) => ({
    label: employeeLabelMap.get(employeeId) ?? "Equipo",
    value: Number(((bookedMinutes / (dayCount * DEFAULT_WORKDAY_MINUTES)) * 100).toFixed(1)),
    meta: `${formatInteger(bookedMinutes)} min agendados`,
  })).sort((a, b) => b.value - a.value).slice(0, 10);

  const serviceDemand = Array.from(filteredAppointments.reduce<Map<string, number>>((acc, a) => {
    acc.set(a.service_id, (acc.get(a.service_id) ?? 0) + 1);
    return acc;
  }, new Map())).map(([serviceId, value]) => ({
    label: servicesById.get(serviceId)?.name ?? "Servicio",
    value,
  })).sort((a, b) => b.value - a.value).slice(0, 10);

  const cancelCount = filteredAppointments.filter((a) => a.status === "cancelled").length;
  const noShowCount = filteredAppointments.filter((a) => a.status === "no_show").length;

  return {
    kpis: [
      { label: "Citas registradas", value: formatInteger(totalAppointments), tone: "primary" },
      { label: "Tasa de cancelacion", value: formatPercent(totalAppointments === 0 ? 0 : cancelCount / totalAppointments), tone: "warning" },
      { label: "No asistio", value: formatPercent(totalAppointments === 0 ? 0 : noShowCount / totalAppointments), tone: "error" },
      { label: "Ocupacion lider", value: employeeOccupancy[0] ? `${employeeOccupancy[0].value}%` : "0%", tone: "success", meta: employeeOccupancy[0]?.label ?? "Sin datos" },
    ],
    statusBreakdown,
    employeeOccupancy,
    serviceDemand,
    tableRows: filteredAppointments.slice(0, 120).map((a) => ({
      Fecha: formatDateTime(a.start_time),
      Sucursal: branchLabelMap.get(a.branch_id) ?? "Sucursal",
      Empleado: employeeLabelMap.get(a.employee_id) ?? "Equipo",
      Servicio: servicesById.get(a.service_id)?.name ?? "Servicio",
      Estado: APPOINTMENT_STATUS_LABELS[a.status ?? "pending"] ?? "Pendiente",
    })),
    filterOptions,
  };
}

