import { createClient } from "@supabase/supabase-js";
import { createError } from "h3";

import type { Database } from "@/types/database.types";

import type { ReportsResolvedContext, ReportBranchOption, ReportEmployeeOption, ReportCategoryOption } from "./context";

import type { H3Event } from "h3";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type TransactionItemRow = Database["public"]["Tables"]["transaction_items"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

const startOfDayIso = (value: string) => new Date(`${value}T00:00:00`).toISOString();
const endOfDayIso = (value: string) => new Date(`${value}T23:59:59.999`).toISOString();

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

const sumValues = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 2 }).format(amount);
const formatInteger = (value: number) => new Intl.NumberFormat("es-BO").format(value);

export interface ReportsServicesResult {
  kpis: Array<{ label: string; value: string; tone?: string; meta?: string }>;
  topServices: Array<{ label: string; value: number; meta?: string }>;
  employeeProductivity: Array<{ label: string; value: number; meta?: string }>;
  serviceMix: Array<{ label: string; value: number; meta?: string }>;
  tableRows: Array<Record<string, string | number>>;
  filterOptions: {
    branches: ReportBranchOption[];
    employees: ReportEmployeeOption[];
    productCategories: ReportCategoryOption[];
    serviceCategories: ReportCategoryOption[];
    paymentMethods: Array<{ label: string; value: string }>;
  };
}

export async function getReportsServices(
  event: H3Event,
  context: ReportsResolvedContext,
  filters: { startDate: string; endDate: string; branchIds: string[]; employeeId: string | null; paymentMethod: string; categoryIds: string[] },
  filterOptions: ReportsServicesResult["filterOptions"],
): Promise<ReportsServicesResult> {
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
    .select("id, branch_id, employee_id, created_at, final_amount, payment_method, status, type")
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

  const { data: transactions, error: transactionsError } = await transactionQuery.returns<Pick<TransactionRow, "id" | "branch_id" | "employee_id" | "created_at" | "final_amount" | "payment_method" | "status" | "type">[]>();

  if (transactionsError) {
    throw createError({ statusCode: 500, statusMessage: transactionsError.message });
  }

  const completedTransactions = (transactions ?? []).filter((t) => t.type === "sale" && t.status === "completed");
  const transactionIds = completedTransactions.map((t) => t.id);

  let serviceItems: Pick<TransactionItemRow, "id" | "transaction_id" | "item_type" | "product_id" | "service_id" | "quantity" | "subtotal" | "unit_price">[] = [];
  if (transactionIds.length > 0) {
    const { data: items, error: itemsError } = await adminClient
      .from("transaction_items")
      .select("id, transaction_id, item_type, product_id, service_id, quantity, subtotal, unit_price")
      .in("transaction_id", transactionIds)
      .returns<Pick<TransactionItemRow, "id" | "transaction_id" | "item_type" | "product_id" | "service_id" | "quantity" | "subtotal" | "unit_price">[]>();

    if (itemsError) {
      throw createError({ statusCode: 500, statusMessage: itemsError.message });
    }

    serviceItems = (items ?? []).filter((item) => item.item_type === "service" && item.service_id);
  }

  const serviceIds = Array.from(new Set(serviceItems.map((item) => item.service_id).filter((v): v is string => Boolean(v))));
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

  const filteredServiceItems = serviceItems.filter((item) => {
    const service = item.service_id ? servicesById.get(item.service_id) : null;
    if (!service) {
      return false;
    }

    if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(service.category_id ?? "")) {
      return false;
    }

    return true;
  });

  const topServices = Array.from(filteredServiceItems.reduce<Map<string, { quantity: number; revenue: number }>>((acc, item) => {
    const serviceId = item.service_id ?? "";
    const current = acc.get(serviceId) ?? { quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += item.subtotal;
    acc.set(serviceId, current);
    return acc;
  }, new Map())).map(([serviceId, metrics]) => ({
    label: servicesById.get(serviceId)?.name ?? "Servicio",
    value: metrics.revenue,
    meta: `${formatInteger(metrics.quantity)} servicios`,
  })).sort((a, b) => b.value - a.value).slice(0, 8);

  const transactionMap = new Map(completedTransactions.map((t) => [t.id, t]));
  const employeeProductivity = Array.from(filteredServiceItems.reduce<Map<string, { quantity: number; revenue: number }>>((acc, item) => {
    const transaction = transactionMap.get(item.transaction_id);
    if (!transaction) {
      return acc;
    }

    const current = acc.get(transaction.employee_id) ?? { quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += item.subtotal;
    acc.set(transaction.employee_id, current);
    return acc;
  }, new Map())).map(([employeeId, metrics]) => ({
    label: filterOptions.employees.find((e) => e.value === employeeId)?.label ?? "Equipo",
    value: metrics.revenue,
    meta: `${formatInteger(metrics.quantity)} servicios`,
  })).sort((a, b) => b.value - a.value).slice(0, 8);

  return {
    kpis: [
      { label: "Servicios vendidos", value: formatInteger(sumValues(filteredServiceItems.map((item) => item.quantity))), tone: "primary" },
      { label: "Ingresos por servicios", value: formatCurrency(sumValues(filteredServiceItems.map((item) => item.subtotal))), tone: "success" },
      { label: "Servicio lider", value: topServices[0]?.label ?? "Sin datos", tone: "warning", meta: topServices[0]?.meta ?? "0 servicios" },
      { label: "Empleado lider", value: employeeProductivity[0]?.label ?? "Sin datos", tone: "neutral", meta: employeeProductivity[0]?.meta ?? "0 servicios" },
    ],
    topServices,
    employeeProductivity,
    serviceMix: topServices.map((service) => ({
      label: service.label,
      value: Number(service.meta?.split(" ")[0]?.replaceAll(".", "") ?? 0),
      meta: service.meta,
    })),
    tableRows: topServices.map((service) => ({
      Servicio: service.label,
      Ingresos: formatCurrency(service.value),
      Volumen: service.meta ?? "0 servicios",
    })),
    filterOptions,
  };
}

