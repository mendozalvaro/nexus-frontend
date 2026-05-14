import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import type { H3Event } from "h3";

import type { ReportsResolvedContext, ReportBranchOption, ReportEmployeeOption, ReportCategoryOption } from "./context";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  all: "Todos los metodos",
  card: "Tarjeta",
  cash: "Efectivo",
  digital_wallet: "Billetera digital",
  mixed: "Mixto",
  transfer: "Transferencia",
};

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  in_progress: "En proceso",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistio",
};

const startOfDayIso = (value: string) => new Date(`${value}T00:00:00`).toISOString();
const endOfDayIso = (value: string) => new Date(`${value}T23:59:59.999`).toISOString();

const createIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildDailyTrend = (
  startDate: string,
  endDate: string,
  source: Array<{ created_at: string | null; amount: number }>,
) => {
  const points = new Map<string, number>();
  let currentDate = startDate;

  while (currentDate <= endDate) {
    points.set(currentDate, 0);
    const nextDate = new Date(`${currentDate}T00:00:00`);
    nextDate.setDate(nextDate.getDate() + 1);
    currentDate = createIsoDate(nextDate);
  }

  for (const row of source) {
    if (!row.created_at) {
      continue;
    }

    const dayKey = createIsoDate(new Date(row.created_at));
    if (!points.has(dayKey)) {
      continue;
    }

    points.set(dayKey, (points.get(dayKey) ?? 0) + row.amount);
  }

  return Array.from(points.entries()).map(([date, value]) => ({
    label: new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "short" }).format(new Date(`${date}T00:00:00`)),
    value,
    meta: date,
  }));
};

const sumValues = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
const titleCase = (value: string | null | undefined, fallback: string) => {
  if (!value) {
    return fallback;
  }

  return value
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

export interface ReportsOverviewResult {
  kpis: Array<{ label: string; value: string; tone?: string; meta?: string }>;
  salesTrend: Array<{ label: string; value: number; meta?: string }>;
  paymentMix: Array<{ label: string; value: number; meta?: string }>;
  appointmentStatusMix: Array<{ label: string; value: number; meta?: string }>;
  branchComparison: Array<{ label: string; value: number; meta?: string }>;
  topHighlights: Array<{ label: string; value: string; secondary?: string }>;
  canCompareBranches: boolean;
  filterOptions: {
    branches: ReportBranchOption[];
    employees: ReportEmployeeOption[];
    productCategories: ReportCategoryOption[];
    serviceCategories: ReportCategoryOption[];
    paymentMethods: Array<{ label: string; value: string }>;
  };
}

export async function getReportsOverview(
  event: H3Event,
  context: ReportsResolvedContext,
  filters: { startDate: string; endDate: string; branchIds: string[]; employeeId: string | null; paymentMethod: string; categoryIds: string[] },
  filterOptions: ReportsOverviewResult["filterOptions"],
): Promise<ReportsOverviewResult> {
  const { url, serviceRoleKey } = getSupabaseServerConfig(event);
  const adminClient = createClient<Database, "public">(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const scopedBranchIds = (context.role === "manager"
    ? context.branchIds
    : filters.branchIds.length === 0
      ? context.branchIds
      : context.branchIds.filter((branchId) => filters.branchIds.includes(branchId))) as readonly string[];

  let transactionQuery = adminClient
    .from("transactions")
    .select("id, branch_id, employee_id, created_at, final_amount, total_amount, discount_amount, payment_method, status, type, invoice_number")
    .eq("organization_id", context.organizationId)
    .in("branch_id", scopedBranchIds)
    .gte("created_at", startOfDayIso(filters.startDate))
    .lte("created_at", endOfDayIso(filters.endDate))
    .order("created_at", { ascending: false });

  if (filters.employeeId) {
    transactionQuery = transactionQuery.eq("employee_id", filters.employeeId);
  }

  if (filters.paymentMethod !== "all") {
    transactionQuery = transactionQuery.eq("payment_method", filters.paymentMethod as any);
  }

  const { data: transactions, error: transactionsError } = await transactionQuery.returns<Pick<TransactionRow, "id" | "branch_id" | "employee_id" | "created_at" | "final_amount" | "total_amount" | "discount_amount" | "payment_method" | "status" | "type" | "invoice_number">[]>();

  if (transactionsError) {
    throw createError({ statusCode: 500, statusMessage: transactionsError.message });
  }

  const saleTransactions = (transactions ?? []).filter((t) => t.type === "sale");
  const completedTransactions = saleTransactions.filter((t) => t.status === "completed");

  let appointmentsQuery = adminClient
    .from("appointments")
    .select("id, employee_id, service_id, status, start_time, end_time, branch_id")
    .eq("organization_id", context.organizationId)
    .in("branch_id", scopedBranchIds)
    .gte("start_time", startOfDayIso(filters.startDate))
    .lte("start_time", endOfDayIso(filters.endDate));

  if (filters.employeeId) {
    appointmentsQuery = appointmentsQuery.eq("employee_id", filters.employeeId);
  }

  const { data: appointments, error: appointmentsError } = await appointmentsQuery.returns<Pick<AppointmentRow, "id" | "employee_id" | "service_id" | "status" | "start_time" | "end_time" | "branch_id">[]>();

  if (appointmentsError) {
    throw createError({ statusCode: 500, statusMessage: appointmentsError.message });
  }

  const appointmentRows = appointments ?? [];

  const salesTrend = buildDailyTrend(filters.startDate, filters.endDate, completedTransactions.map((t) => ({
    created_at: t.created_at,
    amount: t.final_amount,
  })));

  const paymentMix = Array.from(
    completedTransactions.reduce<Map<string, number>>((acc, t) => {
      const key = t.payment_method ?? "cash";
      acc.set(key, (acc.get(key) ?? 0) + t.final_amount);
      return acc;
    }, new Map()),
  ).map(([label, value]) => ({
    label: PAYMENT_METHOD_LABELS[label as string] ?? titleCase(label, "Metodo"),
    value,
  }));

  const appointmentStatusMix = Array.from(
    appointmentRows.reduce<Map<string, number>>((acc, a) => {
      const key = a.status ?? "pending";
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    }, new Map()),
  ).map(([label, value]) => ({
    label: APPOINTMENT_STATUS_LABELS[label as string] ?? titleCase(label, "Estado"),
    value,
  }));

  const branchLabelMap = new Map(filterOptions.branches.map((b) => [b.value, b.label]));

  const branchComparison = Array.from(
    completedTransactions.reduce<Map<string, number>>((acc, t) => {
      acc.set(t.branch_id, (acc.get(t.branch_id) ?? 0) + t.final_amount);
      return acc;
    }, new Map()),
  ).map(([branchId, value]) => ({
    label: branchLabelMap.get(branchId) ?? "Sucursal",
    value,
  }));

  const totalSales = sumValues(completedTransactions.map((t) => t.final_amount));
  const avgTicket = completedTransactions.length === 0 ? 0 : totalSales / completedTransactions.length;
  const cancelRate = appointmentRows.length === 0 ? 0 : appointmentRows.filter((a) => a.status === "cancelled").length / appointmentRows.length;
  const noShowRate = appointmentRows.length === 0 ? 0 : appointmentRows.filter((a) => a.status === "no_show").length / appointmentRows.length;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 2 }).format(amount);
  const formatInteger = (value: number) => new Intl.NumberFormat("es-BO").format(value);
  const formatPercent = (value: number) =>
    new Intl.NumberFormat("es-BO", { style: "percent", maximumFractionDigits: 1 }).format(value);

  return {
    kpis: [
      { label: "Ventas netas", value: formatCurrency(totalSales), tone: "primary", meta: `${formatInteger(completedTransactions.length)} transacciones completadas` },
      { label: "Ticket promedio", value: formatCurrency(avgTicket), tone: "success" },
      { label: "Tasa de cancelacion", value: formatPercent(cancelRate), tone: "warning" },
      { label: "No asistio", value: formatPercent(noShowRate), tone: "error" },
    ],
    salesTrend,
    paymentMix,
    appointmentStatusMix,
    branchComparison,
    topHighlights: [
      { label: "Ventas completadas", value: formatCurrency(totalSales), secondary: `${formatInteger(completedTransactions.length)} tickets` },
      { label: "Citas atendidas", value: formatInteger(appointmentRows.filter((a) => a.status === "completed").length), secondary: `${formatInteger(appointmentRows.length)} citas` },
      { label: "Placeholder fase 2", value: "Envio por email", secondary: "Programacion de reportes pendiente" },
    ],
    canCompareBranches: context.role === "admin",
    filterOptions,
  };
}

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

