import type { Database } from "@/types/database.types";
import type { OrganizationCapabilities } from "@/types/subscription";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type InventoryMovementRow = Database["public"]["Tables"]["inventory_movements"]["Row"];
type InventoryStockRow = Database["public"]["Tables"]["inventory_stock"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type TransactionItemRow = Database["public"]["Tables"]["transaction_items"]["Row"];
type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
type ReportRole = Extract<Database["public"]["Enums"]["user_role"], "admin" | "manager">;
type CategoryKind = "product" | "service";

export interface ReportFilters {
  startDate: string;
  endDate: string;
  branchIds: string[];
  employeeId: string | null;
  paymentMethod: PaymentMethod | "all";
  categoryIds: string[];
}

export interface ReportBranchOption {
  label: string;
  value: string;
}

export interface ReportEmployeeOption {
  label: string;
  value: string;
}

export interface ReportCategoryOption {
  label: string;
  value: string;
  kind: CategoryKind;
}

export interface ReportsFilterOptions {
  branches: ReportBranchOption[];
  employees: ReportEmployeeOption[];
  productCategories: ReportCategoryOption[];
  serviceCategories: ReportCategoryOption[];
  paymentMethods: Array<{ label: string; value: PaymentMethod | "all" }>;
}

export interface ReportKpi {
  label: string;
  value: string;
  tone?: "primary" | "success" | "warning" | "error" | "neutral";
  meta?: string;
}

export interface ReportChartDatum {
  label: string;
  value: number;
  meta?: string;
}

export interface ReportTableRow {
  label: string;
  value: string;
  secondary?: string;
  tone?: "primary" | "success" | "warning" | "error" | "neutral";
}

export interface ReportsResolvedContext {
  organizationId: string;
  role: ReportRole;
  timezone: string;
  branchIds: string[];
  assignedBranchId: string | null;
  capabilities: OrganizationCapabilities | null;
}

export interface ReportsOverviewData {
  context: ReportsResolvedContext;
  filters: ReportFilters;
  filterOptions: ReportsFilterOptions;
  kpis: ReportKpi[];
  salesTrend: ReportChartDatum[];
  paymentMix: ReportChartDatum[];
  appointmentStatusMix: ReportChartDatum[];
  branchComparison: ReportChartDatum[];
  topHighlights: ReportTableRow[];
  canCompareBranches: boolean;
}

export interface SalesReportData {
  context: ReportsResolvedContext;
  filters: ReportFilters;
  filterOptions: ReportsFilterOptions;
  kpis: ReportKpi[];
  salesTrend: ReportChartDatum[];
  paymentBreakdown: ReportChartDatum[];
  branchBreakdown: ReportChartDatum[];
  employeeBreakdown: ReportChartDatum[];
  transactionsTable: Array<Record<string, string | number>>;
}

export interface ServicesReportData {
  context: ReportsResolvedContext;
  filters: ReportFilters;
  filterOptions: ReportsFilterOptions;
  kpis: ReportKpi[];
  topServices: ReportChartDatum[];
  employeeProductivity: ReportChartDatum[];
  serviceMix: ReportChartDatum[];
  tableRows: Array<Record<string, string | number>>;
}

export interface ProductsReportData {
  context: ReportsResolvedContext;
  filters: ReportFilters;
  filterOptions: ReportsFilterOptions;
  kpis: ReportKpi[];
  topProducts: ReportChartDatum[];
  rotation: ReportChartDatum[];
  lowStock: ReportChartDatum[];
  movementSummary: ReportChartDatum[];
  tableRows: Array<Record<string, string | number>>;
}

export interface AppointmentsReportData {
  context: ReportsResolvedContext;
  filters: ReportFilters;
  filterOptions: ReportsFilterOptions;
  kpis: ReportKpi[];
  statusBreakdown: ReportChartDatum[];
  employeeOccupancy: ReportChartDatum[];
  serviceDemand: ReportChartDatum[];
  tableRows: Array<Record<string, string | number>>;
}

interface LoadedFiltersSupport {
  filterOptions: ReportsFilterOptions;
  branchLabelMap: Map<string, string>;
  employeeLabelMap: Map<string, string>;
  productCategoryLabelMap: Map<string, string>;
  serviceCategoryLabelMap: Map<string, string>;
}

interface TransactionScope {
  transactions: TransactionRow[];
  branchLabelMap: Map<string, string>;
  employeeLabelMap: Map<string, string>;
}

const DEFAULT_RANGE_DAYS = 30;
const DEFAULT_WORKDAY_MINUTES = 8 * 60;
const REPORT_CONTEXT_CACHE_TTL_MS = 30_000;
const reportsContextInFlight = new Map<string, Promise<ReportsResolvedContext>>();

const PAYMENT_METHOD_LABELS: Record<PaymentMethod | "all", string> = {
  all: "Todos los métodos",
  card: "Tarjeta",
  cash: "Efectivo",
  digital_wallet: "Billetera digital",
  mixed: "Mixto",
  transfer: "Transferencia",
};

const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  in_progress: "En proceso",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

const createIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getToday = () => createIsoDate(new Date());

const getRangeStart = () => {
  const date = new Date();
  date.setDate(date.getDate() - (DEFAULT_RANGE_DAYS - 1));
  return createIsoDate(date);
};

const startOfDayIso = (value: string) => new Date(`${value}T00:00:00`).toISOString();
const endOfDayIso = (value: string) => new Date(`${value}T23:59:59.999`).toISOString();

const normalizeFilters = (filters?: Partial<ReportFilters>): ReportFilters => {
  const startDate = filters?.startDate ?? getRangeStart();
  const endDate = filters?.endDate ?? getToday();

  if (startDate <= endDate) {
    return {
      startDate,
      endDate,
      branchIds: filters?.branchIds ?? [],
      employeeId: filters?.employeeId ?? null,
      paymentMethod: filters?.paymentMethod ?? "all",
      categoryIds: filters?.categoryIds ?? [],
    };
  }

  return {
    startDate: endDate,
    endDate: startDate,
    branchIds: filters?.branchIds ?? [],
    employeeId: filters?.employeeId ?? null,
    paymentMethod: filters?.paymentMethod ?? "all",
    categoryIds: filters?.categoryIds ?? [],
  };
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

export const useReports = () => {
  const supabase = useSupabaseClient<Database>();
  const { ensureContext, profile, user } = useUserContext();
  const { getAccessibleBranches } = usePermissions();
  const { capabilities, loadCapabilities } = useSubscription();
  const contextCache = useState<{
    key: string | null;
    value: ReportsResolvedContext | null;
    fetchedAt: number;
  }>("reports:context-cache", () => ({
    key: null,
    value: null,
    fetchedAt: 0,
  }));

  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-BO", {
      style: "currency",
      currency: "BOB",
      maximumFractionDigits: 2,
    }).format(amount);

  const formatInteger = (value: number) => new Intl.NumberFormat("es-BO").format(value);

  const formatPercent = (value: number) =>
    new Intl.NumberFormat("es-BO", {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(value);

  const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat("es-BO", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: localTimeZone,
    }).format(new Date(value));
  const loadContext = async (): Promise<ReportsResolvedContext> => {
    const resolved = await ensureContext({ requireProfile: true });
    const currentUser = resolved.user;
    const currentProfile = resolved.profile;

    if (!currentUser || !currentProfile) {
      throw createError({
        statusCode: 401,
        statusMessage: "La sesión no está disponible para consultar reportes.",
      });
    }

    if (
      !currentProfile.organization_id
      || (currentProfile.role !== "admin" && currentProfile.role !== "manager")
    ) {
      throw createError({
        statusCode: 403,
        statusMessage: "Solo admin y manager pueden acceder a reportes.",
      });
    }

    const organizationId = currentProfile.organization_id;
    const role = currentProfile.role;
    const cacheKey = `${currentUser.id}:${organizationId}:${role}`;
    if (
      contextCache.value.key === cacheKey
      && contextCache.value.value
      && Date.now() - contextCache.value.fetchedAt < REPORT_CONTEXT_CACHE_TTL_MS
    ) {
      return contextCache.value.value;
    }

    const inFlight = reportsContextInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const contextPromise = (async () => {
      await loadCapabilities(organizationId);
      const accessibleBranches = await getAccessibleBranches();
      const branchIds = accessibleBranches.map((branch) => branch.id);

      if (branchIds.length === 0) {
        throw createError({
          statusCode: 403,
          statusMessage: "No hay sucursales disponibles para generar reportes.",
        });
      }

      const context: ReportsResolvedContext = {
        organizationId,
        role,
        timezone: localTimeZone,
        branchIds: role === "manager" ? [branchIds[0] ?? ""] : branchIds,
        assignedBranchId: role === "manager" ? branchIds[0] ?? null : null,
        capabilities: capabilities.value,
      };

      contextCache.value = {
        key: cacheKey,
        value: context,
        fetchedAt: Date.now(),
      };

      return context;
    })();
    reportsContextInFlight.set(cacheKey, contextPromise);

    try {
      return await contextPromise;
    } finally {
      if (reportsContextInFlight.get(cacheKey) === contextPromise) {
        reportsContextInFlight.delete(cacheKey);
      }
    }
  };

  watch(
    () => [
      user.value?.id ?? null,
      profile.value?.id ?? null,
      profile.value?.organization_id ?? null,
      profile.value?.role ?? null,
    ] as const,
    () => {
      contextCache.value = {
        key: null,
        value: null,
        fetchedAt: 0,
      };
      reportsContextInFlight.clear();
    },
  );

  const loadFilterSupport = async (context: ReportsResolvedContext): Promise<LoadedFiltersSupport> => {
    const [branchesResult, employeesResult, assignmentsResult, categoriesResult] = await Promise.all([
      supabase
        .from("branches")
        .select("id, name, code")
        .eq("organization_id", context.organizationId)
        .in("id", context.branchIds)
        .order("name", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("organization_id", context.organizationId)
        .in("role", ["manager", "employee"])
        .order("full_name", { ascending: true }),
      supabase
        .from("employee_branch_assignments")
        .select("user_id, branch_id")
        .in("branch_id", context.branchIds)
        .returns<Array<Pick<AssignmentRow, "user_id" | "branch_id">>>(),
      supabase
        .from("categories")
        .select("id, name, type, is_active")
        .eq("organization_id", context.organizationId)
        .eq("is_active", true)
        .in("type", ["product", "service"])
        .order("name", { ascending: true }),
    ]);

    if (branchesResult.error || employeesResult.error || categoriesResult.error || assignmentsResult.error) {
      throw createError({
        statusCode: 500,
        statusMessage: branchesResult.error?.message
          ?? employeesResult.error?.message
          ?? assignmentsResult.error?.message
          ?? categoriesResult.error?.message
          ?? "No se pudieron cargar los filtros de reportes.",
      });
    }

    const branchRows = branchesResult.data ?? [];
    const assignmentRows = assignmentsResult.data ?? [];
    const employeeRows = (employeesResult.data ?? []).filter((employee) => {
      if (context.role === "admin") {
        return true;
      }

      return assignmentRows.some((assignment) =>
        assignment.user_id === employee.id && assignment.branch_id === context.assignedBranchId,
      );
    });

    const categories = (categoriesResult.data ?? []) as Array<Pick<CategoryRow, "id" | "name" | "type" | "is_active">>;
    const productCategories = categories
      .filter((category) => category.type === "product")
      .map((category) => ({ label: category.name, value: category.id, kind: "product" as const }));
    const serviceCategories = categories
      .filter((category) => category.type === "service")
      .map((category) => ({ label: category.name, value: category.id, kind: "service" as const }));

    return {
      filterOptions: {
        branches: branchRows.map((branch) => ({ label: `${branch.name} (${branch.code})`, value: branch.id })),
        employees: employeeRows.map((employee) => ({ label: employee.full_name, value: employee.id })),
        productCategories,
        serviceCategories,
        paymentMethods: [
          { label: PAYMENT_METHOD_LABELS.all, value: "all" },
          { label: PAYMENT_METHOD_LABELS.cash, value: "cash" },
          { label: PAYMENT_METHOD_LABELS.card, value: "card" },
          { label: PAYMENT_METHOD_LABELS.transfer, value: "transfer" },
          { label: PAYMENT_METHOD_LABELS.mixed, value: "mixed" },
          { label: PAYMENT_METHOD_LABELS.digital_wallet, value: "digital_wallet" },
        ],
      },
      branchLabelMap: new Map(branchRows.map((branch) => [branch.id, `${branch.name} (${branch.code})`])),
      employeeLabelMap: new Map(employeeRows.map((employee) => [employee.id, employee.full_name])),
      productCategoryLabelMap: new Map(productCategories.map((category) => [category.value, category.label])),
      serviceCategoryLabelMap: new Map(serviceCategories.map((category) => [category.value, category.label])),
    };
  };

  const resolveScopedBranchIds = (context: ReportsResolvedContext, filters: ReportFilters) => {
    if (context.role === "manager") {
      return context.branchIds;
    }

    if (filters.branchIds.length === 0) {
      return context.branchIds;
    }

    return context.branchIds.filter((branchId) => filters.branchIds.includes(branchId));
  };

  const loadTransactions = async (
    context: ReportsResolvedContext,
    filters: ReportFilters,
    branchLabelMap: Map<string, string>,
    employeeLabelMap: Map<string, string>,
  ): Promise<TransactionScope> => {
    const scopedBranchIds = resolveScopedBranchIds(context, filters);

    let query = supabase
      .from("transactions")
      .select("id, branch_id, employee_id, created_at, final_amount, total_amount, discount_amount, payment_method, status, type, invoice_number")
      .eq("organization_id", context.organizationId)
      .in("branch_id", scopedBranchIds)
      .gte("created_at", startOfDayIso(filters.startDate))
      .lte("created_at", endOfDayIso(filters.endDate))
      .order("created_at", { ascending: false });

    if (filters.employeeId) {
      query = query.eq("employee_id", filters.employeeId);
    }

    if (filters.paymentMethod !== "all") {
      query = query.eq("payment_method", filters.paymentMethod);
    }

    const { data, error } = await query.returns<Array<Pick<TransactionRow, "id" | "branch_id" | "employee_id" | "created_at" | "final_amount" | "total_amount" | "discount_amount" | "payment_method" | "status" | "type" | "invoice_number">>>();

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message,
      });
    }

    return {
      transactions: (data ?? []).map((transaction) => ({
        ...transaction,
        organization_id: context.organizationId,
      })) as TransactionRow[],
      branchLabelMap,
      employeeLabelMap,
    };
  };

  const loadTransactionItems = async (transactionIds: string[]) => {
    if (transactionIds.length === 0) {
      return [] as TransactionItemRow[];
    }

    const { data, error } = await supabase
      .from("transaction_items")
      .select("id, transaction_id, item_type, product_id, service_id, quantity, subtotal, unit_price, snapshot_data")
      .in("transaction_id", transactionIds)
      .returns<Array<Pick<TransactionItemRow, "id" | "transaction_id" | "item_type" | "product_id" | "service_id" | "quantity" | "subtotal" | "unit_price" | "snapshot_data">>>();

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message,
      });
    }

    return (data ?? []).map((item) => ({ ...item })) as TransactionItemRow[];
  };

  const loadProductsByIds = async (organizationId: string, productIds: string[]) => {
    if (productIds.length === 0) {
      return new Map<string, ProductRow>();
    }

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("organization_id", organizationId)
      .in("id", productIds)
      .returns<ProductRow[]>();

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message });
    }

    return new Map((data ?? []).map((product) => [product.id, product]));
  };

  const loadServicesByIds = async (organizationId: string, serviceIds: string[]) => {
    if (serviceIds.length === 0) {
      return new Map<string, ServiceRow>();
    }

    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("organization_id", organizationId)
      .in("id", serviceIds)
      .returns<ServiceRow[]>();

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message });
    }

    return new Map((data ?? []).map((service) => [service.id, service]));
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

  const buildCsv = (rows: Array<Record<string, string | number>>) => {
    if (rows.length === 0) {
      return "sin_datos\n";
    }

    const headers = Object.keys(rows[0] ?? {});
    const escapeCell = (value: string | number) => `"${String(value).replaceAll("\"", "\"\"")}"`;
    const lines = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escapeCell(row[header] ?? "")).join(",")),
    ];

    return lines.join("\n");
  };

  const downloadCsv = (filename: string, rows: Array<Record<string, string | number>>) => {
    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printHtml = (title: string, rows: Array<Record<string, string | number>>) => {
    const reportWindow = window.open("", "_blank", "noopener,noreferrer,width=1100,height=720");
    if (!reportWindow) {
      return;
    }

    const headers = Object.keys(rows[0] ?? {});
    const headHtml = headers.map((header) => `<th>${header}</th>`).join("");
    const bodyHtml = rows.map((row) => {
      const cells = headers.map((header) => `<td>${String(row[header] ?? "")}</td>`).join("");
      return `<tr>${cells}</tr>`;
    }).join("");

    reportWindow.document.write(`<!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
            h1 { margin-bottom: 8px; }
            p { color: #475569; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
            th { background: #e2e8f0; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p>PDF listo para impresión. La automatización de envío por email queda reservada como fase 2.</p>
          <table>
            <thead><tr>${headHtml}</tr></thead>
            <tbody>${bodyHtml || `<tr><td colspan="${headers.length || 1}">Sin datos</td></tr>`}</tbody>
          </table>
        </body>
      </html>`);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  const getDefaultFilters = (context?: Pick<ReportsResolvedContext, "role" | "assignedBranchId">): ReportFilters => {
    const base = normalizeFilters();
    if (context?.role === "manager" && context.assignedBranchId) {
      return {
        ...base,
        branchIds: [context.assignedBranchId],
      };
    }

    return base;
  };

  const loadOverviewReport = async (filters?: Partial<ReportFilters>): Promise<ReportsOverviewData> => {
    const context = await loadContext();
    const normalizedFilters = normalizeFilters(filters);
    const support = await loadFilterSupport(context);
    const transactionsScope = await loadTransactions(context, normalizedFilters, support.branchLabelMap, support.employeeLabelMap);
    const scopedTransactions = transactionsScope.transactions.filter((transaction) => transaction.type === "sale");
    const completedTransactions = scopedTransactions.filter((transaction) => transaction.status === "completed");

    let appointmentsQuery = supabase
      .from("appointments")
      .select("id, employee_id, service_id, status, start_time, end_time, branch_id")
      .eq("organization_id", context.organizationId)
      .in("branch_id", resolveScopedBranchIds(context, normalizedFilters))
      .gte("start_time", startOfDayIso(normalizedFilters.startDate))
      .lte("start_time", endOfDayIso(normalizedFilters.endDate));

    if (normalizedFilters.employeeId) {
      appointmentsQuery = appointmentsQuery.eq("employee_id", normalizedFilters.employeeId);
    }

    const appointmentsResult = await appointmentsQuery.returns<Array<Pick<AppointmentRow, "id" | "employee_id" | "service_id" | "status" | "start_time" | "end_time" | "branch_id">>>();
    if (appointmentsResult.error) {
      throw createError({ statusCode: 500, statusMessage: appointmentsResult.error.message });
    }

    const appointments = (appointmentsResult.data ?? []) as AppointmentRow[];
    const salesTrend = buildDailyTrend(normalizedFilters.startDate, normalizedFilters.endDate, completedTransactions.map((transaction) => ({
      created_at: transaction.created_at,
      amount: transaction.final_amount,
    })));

    const paymentMix = Array.from(
      completedTransactions.reduce<Map<string, number>>((accumulator, transaction) => {
        const key = transaction.payment_method ?? "cash";
        accumulator.set(key, (accumulator.get(key) ?? 0) + transaction.final_amount);
        return accumulator;
      }, new Map()),
    ).map(([label, value]) => ({
      label: PAYMENT_METHOD_LABELS[label as PaymentMethod] ?? titleCase(label, "Método"),
      value,
    }));

    const appointmentStatusMix = Array.from(
      appointments.reduce<Map<string, number>>((accumulator, appointment) => {
        const key = appointment.status ?? "pending";
        accumulator.set(key, (accumulator.get(key) ?? 0) + 1);
        return accumulator;
      }, new Map()),
    ).map(([label, value]) => ({
      label: APPOINTMENT_STATUS_LABELS[label as AppointmentStatus] ?? titleCase(label, "Estado"),
      value,
    }));

    const branchComparison = Array.from(
      completedTransactions.reduce<Map<string, number>>((accumulator, transaction) => {
        accumulator.set(transaction.branch_id, (accumulator.get(transaction.branch_id) ?? 0) + transaction.final_amount);
        return accumulator;
      }, new Map()),
    ).map(([branchId, value]) => ({
      label: support.branchLabelMap.get(branchId) ?? "Sucursal",
      value,
    }));

    return {
      context,
      filters: normalizedFilters,
      filterOptions: support.filterOptions,
      kpis: [
        {
          label: "Ventas netas",
          value: formatCurrency(sumValues(completedTransactions.map((transaction) => transaction.final_amount))),
          tone: "primary",
          meta: `${formatInteger(completedTransactions.length)} transacciones completadas`,
        },
        {
          label: "Ticket promedio",
          value: formatCurrency(completedTransactions.length === 0 ? 0 : sumValues(completedTransactions.map((transaction) => transaction.final_amount)) / completedTransactions.length),
          tone: "success",
        },
        {
          label: "Tasa de cancelación",
          value: formatPercent(appointments.length === 0 ? 0 : appointments.filter((appointment) => appointment.status === "cancelled").length / appointments.length),
          tone: "warning",
        },
        {
          label: "No-show",
          value: formatPercent(appointments.length === 0 ? 0 : appointments.filter((appointment) => appointment.status === "no_show").length / appointments.length),
          tone: "error",
        },
      ],
      salesTrend,
      paymentMix,
      appointmentStatusMix,
      branchComparison,
      topHighlights: [
        {
          label: "Ventas completadas",
          value: formatCurrency(sumValues(completedTransactions.map((transaction) => transaction.final_amount))),
          secondary: `${formatInteger(completedTransactions.length)} tickets`,
        },
        {
          label: "Citas atendidas",
          value: formatInteger(appointments.filter((appointment) => appointment.status === "completed").length),
          secondary: `${formatInteger(appointments.length)} citas`,
        },
        {
          label: "Placeholder fase 2",
          value: "Envío por email",
          secondary: "Programación de reportes pendiente",
        },
      ],
      canCompareBranches: context.role === "admin" && Boolean(context.capabilities?.hasAdvancedReports),
    };
  };

  const loadSalesReport = async (filters?: Partial<ReportFilters>): Promise<SalesReportData> => {
    const context = await loadContext();
    const normalizedFilters = normalizeFilters(filters);
    const support = await loadFilterSupport(context);
    const scope = await loadTransactions(context, normalizedFilters, support.branchLabelMap, support.employeeLabelMap);
    const saleTransactions = scope.transactions.filter((transaction) => transaction.type === "sale");
    const completedTransactions = saleTransactions.filter((transaction) => transaction.status === "completed");

    return {
      context,
      filters: normalizedFilters,
      filterOptions: support.filterOptions,
      kpis: [
        { label: "Ventas netas", value: formatCurrency(sumValues(completedTransactions.map((transaction) => transaction.final_amount))), tone: "primary" },
        { label: "Tickets completados", value: formatInteger(completedTransactions.length), tone: "success" },
        { label: "Descuentos aplicados", value: formatCurrency(sumValues(saleTransactions.map((transaction) => transaction.discount_amount ?? 0))), tone: "warning" },
        { label: "Ticket promedio", value: formatCurrency(completedTransactions.length === 0 ? 0 : sumValues(completedTransactions.map((transaction) => transaction.final_amount)) / completedTransactions.length), tone: "neutral" },
      ],
      salesTrend: buildDailyTrend(normalizedFilters.startDate, normalizedFilters.endDate, completedTransactions.map((transaction) => ({
        created_at: transaction.created_at,
        amount: transaction.final_amount,
      }))),
      paymentBreakdown: Array.from(completedTransactions.reduce<Map<string, number>>((accumulator, transaction) => {
        const key = transaction.payment_method ?? "cash";
        accumulator.set(key, (accumulator.get(key) ?? 0) + transaction.final_amount);
        return accumulator;
      }, new Map())).map(([label, value]) => ({
        label: PAYMENT_METHOD_LABELS[label as PaymentMethod] ?? titleCase(label, "Método"),
        value,
      })),
      branchBreakdown: Array.from(completedTransactions.reduce<Map<string, number>>((accumulator, transaction) => {
        accumulator.set(transaction.branch_id, (accumulator.get(transaction.branch_id) ?? 0) + transaction.final_amount);
        return accumulator;
      }, new Map())).map(([branchId, value]) => ({
        label: support.branchLabelMap.get(branchId) ?? "Sucursal",
        value,
      })),
      employeeBreakdown: Array.from(completedTransactions.reduce<Map<string, number>>((accumulator, transaction) => {
        accumulator.set(transaction.employee_id, (accumulator.get(transaction.employee_id) ?? 0) + transaction.final_amount);
        return accumulator;
      }, new Map())).map(([employeeId, value]) => ({
        label: support.employeeLabelMap.get(employeeId) ?? "Equipo",
        value,
      })),
      transactionsTable: completedTransactions.slice(0, 120).map((transaction) => ({
        Factura: `#${transaction.invoice_number}`,
        Fecha: transaction.created_at ? formatDateTime(transaction.created_at) : "Sin fecha",
        Sucursal: support.branchLabelMap.get(transaction.branch_id) ?? "Sucursal",
        Responsable: support.employeeLabelMap.get(transaction.employee_id) ?? "Equipo",
        Metodo: PAYMENT_METHOD_LABELS[transaction.payment_method ?? "cash"] ?? "Sin método",
        Total: formatCurrency(transaction.final_amount),
        Estado: titleCase(transaction.status, "Pendiente"),
      })),
    };
  };

  const loadServicesReport = async (filters?: Partial<ReportFilters>): Promise<ServicesReportData> => {
    const context = await loadContext();
    const normalizedFilters = normalizeFilters(filters);
    const support = await loadFilterSupport(context);
    const scope = await loadTransactions(context, normalizedFilters, support.branchLabelMap, support.employeeLabelMap);
    const completedTransactions = scope.transactions.filter((transaction) => transaction.type === "sale" && transaction.status === "completed");
    const items = await loadTransactionItems(completedTransactions.map((transaction) => transaction.id));
    const serviceItems = items.filter((item) => item.item_type === "service" && item.service_id);
    const servicesById = await loadServicesByIds(context.organizationId, Array.from(new Set(serviceItems.map((item) => item.service_id).filter((value): value is string => Boolean(value)))));

    const filteredServiceItems = serviceItems.filter((item) => {
      const service = item.service_id ? servicesById.get(item.service_id) : null;
      if (!service) {
        return false;
      }

      if (normalizedFilters.categoryIds.length > 0 && !normalizedFilters.categoryIds.includes(service.category_id ?? "")) {
        return false;
      }

      return true;
    });

    const topServices = Array.from(filteredServiceItems.reduce<Map<string, { quantity: number; revenue: number }>>((accumulator, item) => {
      const serviceId = item.service_id ?? "";
      const current = accumulator.get(serviceId) ?? { quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.subtotal;
      accumulator.set(serviceId, current);
      return accumulator;
    }, new Map())).map(([serviceId, metrics]) => ({
      label: servicesById.get(serviceId)?.name ?? "Servicio",
      value: metrics.revenue,
      meta: `${formatInteger(metrics.quantity)} servicios`,
    })).sort((left, right) => right.value - left.value).slice(0, 8);

    const transactionMap = new Map(completedTransactions.map((transaction) => [transaction.id, transaction]));
    const employeeProductivity = Array.from(filteredServiceItems.reduce<Map<string, { quantity: number; revenue: number }>>((accumulator, item) => {
      const transaction = transactionMap.get(item.transaction_id);
      if (!transaction) {
        return accumulator;
      }

      const current = accumulator.get(transaction.employee_id) ?? { quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.subtotal;
      accumulator.set(transaction.employee_id, current);
      return accumulator;
    }, new Map())).map(([employeeId, metrics]) => ({
      label: support.employeeLabelMap.get(employeeId) ?? "Equipo",
      value: metrics.revenue,
      meta: `${formatInteger(metrics.quantity)} servicios`,
    })).sort((left, right) => right.value - left.value).slice(0, 8);

    return {
      context,
      filters: normalizedFilters,
      filterOptions: support.filterOptions,
      kpis: [
        { label: "Servicios vendidos", value: formatInteger(sumValues(filteredServiceItems.map((item) => item.quantity))), tone: "primary" },
        { label: "Ingresos por servicios", value: formatCurrency(sumValues(filteredServiceItems.map((item) => item.subtotal))), tone: "success" },
        { label: "Servicio líder", value: topServices[0]?.label ?? "Sin datos", tone: "warning", meta: topServices[0]?.meta ?? "0 servicios" },
        { label: "Empleado líder", value: employeeProductivity[0]?.label ?? "Sin datos", tone: "neutral", meta: employeeProductivity[0]?.meta ?? "0 servicios" },
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
    };
  };

  const loadProductsReport = async (filters?: Partial<ReportFilters>): Promise<ProductsReportData> => {
    const context = await loadContext();
    const normalizedFilters = normalizeFilters(filters);
    const support = await loadFilterSupport(context);
    const scopedBranchIds = resolveScopedBranchIds(context, normalizedFilters);
    const scope = await loadTransactions(context, normalizedFilters, support.branchLabelMap, support.employeeLabelMap);
    const completedTransactions = scope.transactions.filter((transaction) => transaction.type === "sale" && transaction.status === "completed");
    const items = await loadTransactionItems(completedTransactions.map((transaction) => transaction.id));
    const productItems = items.filter((item) => item.item_type === "product" && item.product_id);
    const productsById = await loadProductsByIds(context.organizationId, Array.from(new Set(productItems.map((item) => item.product_id).filter((value): value is string => Boolean(value)))));

    const filteredProductItems = productItems.filter((item) => {
      const product = item.product_id ? productsById.get(item.product_id) : null;
      if (!product) {
        return false;
      }

      if (normalizedFilters.categoryIds.length > 0 && !normalizedFilters.categoryIds.includes(product.category_id ?? "")) {
        return false;
      }

      return true;
    });

    const topProducts = Array.from(filteredProductItems.reduce<Map<string, { quantity: number; revenue: number }>>((accumulator, item) => {
      const productId = item.product_id ?? "";
      const current = accumulator.get(productId) ?? { quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.subtotal;
      accumulator.set(productId, current);
      return accumulator;
    }, new Map())).map(([productId, metrics]) => ({
      label: productsById.get(productId)?.name ?? "Producto",
      value: metrics.quantity,
      meta: formatCurrency(metrics.revenue),
    })).sort((left, right) => right.value - left.value).slice(0, 10);

    const { data: stockRows, error: stockError } = await supabase
      .from("inventory_stock")
      .select("branch_id, product_id, quantity, min_stock_level")
      .in("branch_id", scopedBranchIds)
      .returns<Array<Pick<InventoryStockRow, "branch_id" | "product_id" | "quantity" | "min_stock_level">>>();

    if (stockError) {
      throw createError({ statusCode: 500, statusMessage: stockError.message });
    }

    const stockByProduct = (stockRows ?? []).reduce<Map<string, { quantity: number; minStockLevel: number }>>((accumulator, row) => {
      const current = accumulator.get(row.product_id) ?? { quantity: 0, minStockLevel: 0 };
      current.quantity += row.quantity ?? 0;
      current.minStockLevel += row.min_stock_level ?? 0;
      accumulator.set(row.product_id, current);
      return accumulator;
    }, new Map());

    const rotation = Array.from(stockByProduct.entries()).map(([productId, stock]) => {
      const soldUnits = filteredProductItems
        .filter((item) => item.product_id === productId)
        .reduce((sum, item) => sum + item.quantity, 0);
      return {
        label: productsById.get(productId)?.name ?? "Producto",
        value: stock.quantity > 0 ? Number((soldUnits / stock.quantity).toFixed(2)) : soldUnits,
        meta: `${formatInteger(stock.quantity)} uds en stock`,
      };
    }).sort((left, right) => right.value - left.value).slice(0, 8);

    const lowStock = Array.from(stockByProduct.entries())
      .map(([productId, stock]) => {
        const product = productsById.get(productId);
        if (!product || stock.quantity > stock.minStockLevel) {
          return null;
        }

        return {
          label: product.name,
          value: stock.quantity,
          meta: `Mínimo ${formatInteger(stock.minStockLevel)}`,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => left.value - right.value)
      .slice(0, 8);

    const { data: movementRows, error: movementError } = await supabase
      .from("inventory_movements")
      .select("movement_type, quantity, product_id, created_at")
      .eq("organization_id", context.organizationId)
      .in("branch_id", scopedBranchIds)
      .gte("created_at", startOfDayIso(normalizedFilters.startDate))
      .lte("created_at", endOfDayIso(normalizedFilters.endDate))
      .returns<Array<Pick<InventoryMovementRow, "movement_type" | "quantity" | "product_id" | "created_at">>>();

    if (movementError) {
      throw createError({ statusCode: 500, statusMessage: movementError.message });
    }

    return {
      context,
      filters: normalizedFilters,
      filterOptions: support.filterOptions,
      kpis: [
        { label: "Unidades vendidas", value: formatInteger(sumValues(filteredProductItems.map((item) => item.quantity))), tone: "primary" },
        { label: "Ingresos por productos", value: formatCurrency(sumValues(filteredProductItems.map((item) => item.subtotal))), tone: "success" },
        { label: "Rotación líder", value: rotation[0] ? `${rotation[0].value}x` : "0x", tone: "warning", meta: rotation[0]?.label ?? "Sin datos" },
        { label: "Alertas de stock", value: formatInteger(lowStock.length), tone: "error" },
      ],
      topProducts,
      rotation,
      lowStock,
      movementSummary: Array.from((movementRows ?? []).reduce<Map<string, number>>((accumulator, row) => {
        accumulator.set(row.movement_type, (accumulator.get(row.movement_type) ?? 0) + row.quantity);
        return accumulator;
      }, new Map())).map(([label, value]) => ({
        label: titleCase(label, "Movimiento"),
        value,
      })),
      tableRows: topProducts.map((product) => ({
        Producto: product.label,
        Unidades: formatInteger(product.value),
        Ingresos: product.meta ?? formatCurrency(0),
      })),
    };
  };

  const loadAppointmentsReport = async (filters?: Partial<ReportFilters>): Promise<AppointmentsReportData> => {
    const context = await loadContext();
    const normalizedFilters = normalizeFilters(filters);
    const support = await loadFilterSupport(context);
    const scopedBranchIds = resolveScopedBranchIds(context, normalizedFilters);

    let query = supabase
      .from("appointments")
      .select("id, branch_id, employee_id, service_id, status, start_time, end_time")
      .eq("organization_id", context.organizationId)
      .in("branch_id", scopedBranchIds)
      .gte("start_time", startOfDayIso(normalizedFilters.startDate))
      .lte("start_time", endOfDayIso(normalizedFilters.endDate))
      .order("start_time", { ascending: false });

    if (normalizedFilters.employeeId) {
      query = query.eq("employee_id", normalizedFilters.employeeId);
    }

    const { data, error } = await query.returns<Array<Pick<AppointmentRow, "id" | "branch_id" | "employee_id" | "service_id" | "status" | "start_time" | "end_time">>>();
    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message });
    }

    const appointments = (data ?? []) as AppointmentRow[];
    const servicesById = await loadServicesByIds(context.organizationId, Array.from(new Set(appointments.map((appointment) => appointment.service_id))));

    const filteredAppointments = appointments.filter((appointment) => {
      const service = servicesById.get(appointment.service_id);
      if (!service) {
        return false;
      }

      if (normalizedFilters.categoryIds.length > 0 && !normalizedFilters.categoryIds.includes(service.category_id ?? "")) {
        return false;
      }

      return true;
    });

    const totalAppointments = filteredAppointments.length;
    const dayCount = Math.max(
      1,
      Math.ceil((new Date(`${normalizedFilters.endDate}T23:59:59`).getTime() - new Date(`${normalizedFilters.startDate}T00:00:00`).getTime()) / (24 * 60 * 60 * 1000)),
    );

    const statusBreakdown = Array.from(filteredAppointments.reduce<Map<string, number>>((accumulator, appointment) => {
      const key = appointment.status ?? "pending";
      accumulator.set(key, (accumulator.get(key) ?? 0) + 1);
      return accumulator;
    }, new Map())).map(([status, value]) => ({
      label: APPOINTMENT_STATUS_LABELS[status as AppointmentStatus] ?? titleCase(status, "Estado"),
      value,
    }));

    const employeeOccupancy = Array.from(filteredAppointments.reduce<Map<string, number>>((accumulator, appointment) => {
      const start = new Date(appointment.start_time).getTime();
      const end = new Date(appointment.end_time).getTime();
      const durationMinutes = Math.max(0, Math.round((end - start) / (1000 * 60)));
      accumulator.set(appointment.employee_id, (accumulator.get(appointment.employee_id) ?? 0) + durationMinutes);
      return accumulator;
    }, new Map())).map(([employeeId, bookedMinutes]) => ({
      label: support.employeeLabelMap.get(employeeId) ?? "Equipo",
      value: Number(((bookedMinutes / (dayCount * DEFAULT_WORKDAY_MINUTES)) * 100).toFixed(1)),
      meta: `${formatInteger(bookedMinutes)} min agendados`,
    })).sort((left, right) => right.value - left.value).slice(0, 10);

    const serviceDemand = Array.from(filteredAppointments.reduce<Map<string, number>>((accumulator, appointment) => {
      accumulator.set(appointment.service_id, (accumulator.get(appointment.service_id) ?? 0) + 1);
      return accumulator;
    }, new Map())).map(([serviceId, value]) => ({
      label: servicesById.get(serviceId)?.name ?? "Servicio",
      value,
    })).sort((left, right) => right.value - left.value).slice(0, 10);

    return {
      context,
      filters: normalizedFilters,
      filterOptions: support.filterOptions,
      kpis: [
        { label: "Citas registradas", value: formatInteger(totalAppointments), tone: "primary" },
        { label: "Tasa de cancelación", value: formatPercent(totalAppointments === 0 ? 0 : filteredAppointments.filter((appointment) => appointment.status === "cancelled").length / totalAppointments), tone: "warning" },
        { label: "No-show", value: formatPercent(totalAppointments === 0 ? 0 : filteredAppointments.filter((appointment) => appointment.status === "no_show").length / totalAppointments), tone: "error" },
        { label: "Ocupación líder", value: employeeOccupancy[0] ? `${employeeOccupancy[0].value}%` : "0%", tone: "success", meta: employeeOccupancy[0]?.label ?? "Sin datos" },
      ],
      statusBreakdown,
      employeeOccupancy,
      serviceDemand,
      tableRows: filteredAppointments.slice(0, 120).map((appointment) => ({
        Fecha: formatDateTime(appointment.start_time),
        Sucursal: support.branchLabelMap.get(appointment.branch_id) ?? "Sucursal",
        Empleado: support.employeeLabelMap.get(appointment.employee_id) ?? "Equipo",
        Servicio: servicesById.get(appointment.service_id)?.name ?? "Servicio",
        Estado: APPOINTMENT_STATUS_LABELS[appointment.status ?? "pending"] ?? "Pendiente",
      })),
    };
  };

  return {
    localTimeZone,
    getDefaultFilters,
    loadContext,
    loadOverviewReport,
    loadSalesReport,
    loadServicesReport,
    loadProductsReport,
    loadAppointmentsReport,
    formatCurrency,
    formatInteger,
    formatPercent,
    downloadCsv,
    printHtml,
    PAYMENT_METHOD_LABELS,
  };
};
