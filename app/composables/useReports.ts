import type { Database } from "@/types/database.types";
import type { OrganizationCapabilities } from "@/types/subscription";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];
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

const DEFAULT_RANGE_DAYS = 30;
const REPORT_CONTEXT_CACHE_TTL_MS = 30_000;
const reportsContextInFlight = new Map<string, Promise<ReportsResolvedContext>>();

const PAYMENT_METHOD_LABELS: Record<PaymentMethod | "all", string> = {
  all: "Todos los metodos",
  card: "Tarjeta",
  cash: "Efectivo",
  digital_wallet: "Billetera digital",
  mixed: "Mixto",
  transfer: "Transferencia",
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

export const useReports = () => {
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

  const { resolveAccessToken } = useSessionAccess();

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

  const loadContext = async (): Promise<ReportsResolvedContext> => {
    const resolved = await ensureContext({ requireProfile: true });
    const currentUser = resolved.user;
    const currentProfile = resolved.profile;

    if (!currentUser || !currentProfile) {
      throw createError({
        statusCode: 401,
        statusMessage: "La sesion no esta disponible para consultar reportes.",
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

  const toAuthHeaders = (accessToken: string) => ({
    Authorization: `Bearer ${accessToken}`,
  });

  const getAccessToken = async (): Promise<string> => {
    const token = await resolveAccessToken();
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: "La sesion no esta disponible para consultar reportes.",
      });
    }
    return token;
  };

  const toReportQuery = (filters: ReportFilters) => ({
    startDate: filters.startDate,
    endDate: filters.endDate,
    branchIds: filters.branchIds.join(","),
    employeeId: filters.employeeId ?? "",
    paymentMethod: filters.paymentMethod,
    categoryIds: filters.categoryIds.join(","),
  });

  const loadOverviewReport = async (filters?: Partial<ReportFilters>): Promise<ReportsOverviewData> => {
    const context = await loadContext();
    const normalizedFilters = normalizeFilters(filters);

    const response = await $fetch<ReportsOverviewData>("/api/reports/overview", {
      headers: toAuthHeaders(await getAccessToken()),
      query: toReportQuery(normalizedFilters),
    });

    return {
      ...response,
      context,
      filters: normalizedFilters,
    };
  };

  const loadSalesReport = async (filters?: Partial<ReportFilters>): Promise<SalesReportData> => {
    const context = await loadContext();
    const normalizedFilters = normalizeFilters(filters);

    const response = await $fetch<SalesReportData>("/api/reports/sales", {
      headers: toAuthHeaders(await getAccessToken()),
      query: toReportQuery(normalizedFilters),
    });

    return {
      ...response,
      context,
      filters: normalizedFilters,
    };
  };

  const loadServicesReport = async (filters?: Partial<ReportFilters>): Promise<ServicesReportData> => {
    const context = await loadContext();
    const normalizedFilters = normalizeFilters(filters);

    const response = await $fetch<ServicesReportData>("/api/reports/services", {
      headers: toAuthHeaders(await getAccessToken()),
      query: toReportQuery(normalizedFilters),
    });

    return {
      ...response,
      context,
      filters: normalizedFilters,
    };
  };

  const loadProductsReport = async (filters?: Partial<ReportFilters>): Promise<ProductsReportData> => {
    const context = await loadContext();
    const normalizedFilters = normalizeFilters(filters);

    const response = await $fetch<ProductsReportData>("/api/reports/products", {
      headers: toAuthHeaders(await getAccessToken()),
      query: toReportQuery(normalizedFilters),
    });

    return {
      ...response,
      context,
      filters: normalizedFilters,
    };
  };

  const loadAppointmentsReport = async (filters?: Partial<ReportFilters>): Promise<AppointmentsReportData> => {
    const context = await loadContext();
    const normalizedFilters = normalizeFilters(filters);

    const response = await $fetch<AppointmentsReportData>("/api/reports/appointments", {
      headers: toAuthHeaders(await getAccessToken()),
      query: toReportQuery(normalizedFilters),
    });

    return {
      ...response,
      context,
      filters: normalizedFilters,
    };
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
          <p>PDF listo para impresion.</p>
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
