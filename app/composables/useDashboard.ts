import type { Database } from "@/types/database.types";
import type { OrganizationCapabilities } from "@/types/subscription";
import { getDefaultPathForRole } from "../utils/role-access";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type SubscriptionRow =
  Database["public"]["Tables"]["organization_subscriptions"]["Row"];
type PaymentValidationRow =
  Database["public"]["Tables"]["payment_validations"]["Row"];
type AdminContext = {
  id: string;
  organization_id: string;
  role: "admin";
};

export interface DashboardFilters {
  startDate: string;
  endDate: string;
  branchId: string | null;
}

export interface DashboardBranchOption {
  label: string;
  value: string;
}

export interface DashboardMetricItem {
  label: string;
  value: string;
  meta?: string;
}

export interface DashboardTrendPoint {
  date: string;
  label: string;
  amount: number;
}

export interface DashboardActivityRow {
  id: string;
  invoiceNumber: string;
  branchName: string;
  employeeName: string;
  amount: number;
  paymentMethod: string;
  status: string;
  type: string;
  createdAt: string;
}

export interface DashboardStockAlert {
  stockId: string;
  productId: string;
  productName: string;
  branchName: string;
  quantity: number;
  reservedQuantity: number;
  minStockLevel: number;
  shortage: number;
  updatedAt: string | null;
}

export type DashboardAccountStatus =
  | "pending"
  | "active"
  | "rejected"
  | "suspended";

export interface LimitedDashboardStats {
  sales: number;
  appointments: number;
  products: number;
  employees: number;
  branches: number;
  services: number;
}

export interface LimitedDashboardData {
  profile: Pick<
    ProfileRow,
    "id" | "full_name" | "role" | "organization_id" | "email"
  >;
  organization: Pick<OrganizationRow, "id" | "name" | "country" | "status">;
  subscription: Pick<SubscriptionRow, "status" | "current_period_end"> | null;
  latestValidation: Pick<
    PaymentValidationRow,
    "id" | "status" | "rejection_reason" | "created_at"
  > | null;
  accountStatus: DashboardAccountStatus;
  stats: LimitedDashboardStats;
  capabilities: OrganizationCapabilities | null;
}

export interface DashboardData {
  organizationId: string;
  filters: DashboardFilters;
  branches: DashboardBranchOption[];
  salesTotal: number;
  appointmentsCompleted: number;
  appointmentsCancelled: number;
  topProducts: DashboardMetricItem[];
  branchRevenue: DashboardMetricItem[];
  trend: DashboardTrendPoint[];
  recentActivity: DashboardActivityRow[];
  stockAlerts: DashboardStockAlert[];
  errorMessage: string | null;
}

const DEFAULT_TREND_DAYS = 30;
const RECENT_ACTIVITY_LIMIT = 10;
const STOCK_ALERT_LIMIT = 10;
const LIST_LIMIT = 3;

const createIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getToday = (): string => {
  return createIsoDate(new Date());
};

const getMonthStart = (): string => {
  const date = new Date();
  date.setDate(1);
  return createIsoDate(date);
};

const startOfDayIso = (value: string): string => {
  return new Date(`${value}T00:00:00`).toISOString();
};

const endOfDayIso = (value: string): string => {
  return new Date(`${value}T23:59:59.999`).toISOString();
};

const addDays = (value: string, amount: number): string => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return createIsoDate(date);
};

const normalizeFilters = (filters?: Partial<DashboardFilters>): DashboardFilters => {
  const fallbackStart = getMonthStart();
  const fallbackEnd = getToday();
  const startDate = filters?.startDate ?? fallbackStart;
  const endDate = filters?.endDate ?? fallbackEnd;

  if (startDate <= endDate) {
    return {
      startDate,
      endDate,
      branchId: filters?.branchId ?? null,
    };
  }

  return {
    startDate: endDate,
    endDate: startDate,
    branchId: filters?.branchId ?? null,
  };
};

const formatCompactCurrency = (amount: number): string => {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDateLabel = (value: string): string => {
  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
};

const formatDateTimeLabel = (value: string): string => {
  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatPendingDateLabel = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const titleCase = (value: string | null | undefined, fallback: string): string => {
  if (!value) {
    return fallback;
  }

  return value
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const createEmptyData = (
  organizationId: string,
  filters: DashboardFilters,
  branches: DashboardBranchOption[] = [],
  errorMessage: string | null = null,
): DashboardData => ({
  organizationId,
  filters,
  branches,
  salesTotal: 0,
  appointmentsCompleted: 0,
  appointmentsCancelled: 0,
  topProducts: [],
  branchRevenue: [],
  trend: [],
  recentActivity: [],
  stockAlerts: [],
  errorMessage,
});

export const useDashboard = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSupabaseSession();
  const { resolveUser } = useSessionAccess();
  const { fetchProfile } = useAuth();
  const { loadCapabilities } = useSubscription();

  const pendingDashboard = useState<LimitedDashboardData | null>(
    "dashboard:limited:data",
    () => null,
  );
  const pendingLoading = useState<boolean>(
    "dashboard:limited:loading",
    () => false,
  );
  const pendingError = useState<string | null>(
    "dashboard:limited:error",
    () => null,
  );
  const checkingStatus = useState<boolean>(
    "dashboard:limited:checking-status",
    () => false,
  );
  const lastCheckedAt = useState<string | null>(
    "dashboard:limited:last-checked-at",
    () => null,
  );

  let pendingPollingTimer: number | null = null;

  const resolveAdminContext = async (): Promise<AdminContext> => {
    const userId = (await resolveUser())?.id ?? null;
    if (!userId) {
      throw createError({ statusCode: 401, statusMessage: "Sesión no disponible." });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, organization_id, role")
      .eq("id", userId)
      .maybeSingle<Pick<ProfileRow, "id" | "organization_id" | "role">>();

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: "No se pudo validar el perfil del administrador.",
      });
    }

    if (!data?.organization_id || data.role !== "admin") {
      throw createError({
        statusCode: 403,
        statusMessage: "No tienes permisos para acceder al dashboard administrativo.",
      });
    }

    return {
      id: data.id,
      organization_id: data.organization_id,
      role: "admin",
    };
  };

  const getBranchOptions = async (organizationId: string): Promise<DashboardBranchOption[]> => {
    const { data, error } = await supabase
      .from("branches")
      .select("id, name, code, organization_id, is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map((branch) => ({
      label: `${branch.name} (${branch.code})`,
      value: branch.id,
    }));
  };

  const loadDashboardData = async (filters?: Partial<DashboardFilters>): Promise<DashboardData> => {
    const adminContext = await resolveAdminContext();
    const normalizedFilters = normalizeFilters(filters);
    const branches = await getBranchOptions(adminContext.organization_id);
    const branchLookup = new Map<string, string>(branches.map((branch) => [branch.value, branch.label]));
    const selectedBranchId = normalizedFilters.branchId;
    const scopedBranchIds = selectedBranchId
      ? branches.filter((branch) => branch.value === selectedBranchId).map((branch) => branch.value)
      : branches.map((branch) => branch.value);

    if (selectedBranchId && scopedBranchIds.length === 0) {
      return createEmptyData(
        adminContext.organization_id,
        { ...normalizedFilters, branchId: null },
        branches,
        "La sucursal seleccionada no pertenece a tu organización.",
      );
    }

    if (branches.length === 0) {
      return createEmptyData(
        adminContext.organization_id,
        normalizedFilters,
        [],
        "Aún no hay sucursales activas para mostrar datos en el dashboard.",
      );
    }

    const rangeStartIso = startOfDayIso(normalizedFilters.startDate);
    const rangeEndIso = endOfDayIso(normalizedFilters.endDate);
    const trendStartDate = addDays(normalizedFilters.endDate, -(DEFAULT_TREND_DAYS - 1));
    const trendStartIso = startOfDayIso(trendStartDate);

    try {
      const transactionRangeQuery = supabase
        .from("transactions")
        .select("id, branch_id, employee_id, final_amount, status, type, created_at")
        .eq("organization_id", adminContext.organization_id)
        .gte("created_at", rangeStartIso)
        .lte("created_at", rangeEndIso);

      const appointmentRangeQuery = supabase
        .from("appointments")
        .select("id, status")
        .eq("organization_id", adminContext.organization_id)
        .gte("start_time", rangeStartIso)
        .lte("start_time", rangeEndIso);

      const recentActivityQuery = supabase
        .from("transactions")
        .select("id, invoice_number, branch_id, employee_id, final_amount, payment_method, status, type, created_at")
        .eq("organization_id", adminContext.organization_id)
        .gte("created_at", rangeStartIso)
        .lte("created_at", rangeEndIso)
        .order("created_at", { ascending: false })
        .limit(RECENT_ACTIVITY_LIMIT);

      const trendQuery = supabase
        .from("transactions")
        .select("created_at, final_amount, status, type")
        .eq("organization_id", adminContext.organization_id)
        .gte("created_at", trendStartIso)
        .lte("created_at", rangeEndIso);

      const stockQuery = supabase
        .from("inventory_stock")
        .select("id, branch_id, product_id, quantity, min_stock_level, reserved_quantity, updated_at")
        .in("branch_id", scopedBranchIds);

      if (selectedBranchId !== null) {
        transactionRangeQuery.eq("branch_id", selectedBranchId);
        appointmentRangeQuery.eq("branch_id", selectedBranchId);
        recentActivityQuery.eq("branch_id", selectedBranchId);
        trendQuery.eq("branch_id", selectedBranchId);
      }

      const [
        transactionsResponse,
        appointmentsResponse,
        recentActivityResponse,
        trendResponse,
        stockResponse,
      ] = await Promise.all([
        transactionRangeQuery,
        appointmentRangeQuery,
        recentActivityQuery,
        trendQuery,
        stockQuery,
      ]);

      if (transactionsResponse.error) throw transactionsResponse.error;
      if (appointmentsResponse.error) throw appointmentsResponse.error;
      if (recentActivityResponse.error) throw recentActivityResponse.error;
      if (trendResponse.error) throw trendResponse.error;
      if (stockResponse.error) throw stockResponse.error;

      const transactions = transactionsResponse.data ?? [];
      const appointments = appointmentsResponse.data ?? [];
      const recentTransactions = recentActivityResponse.data ?? [];
      const trendTransactions = trendResponse.data ?? [];
      const stockRows = stockResponse.data ?? [];

      const completedSales = transactions.filter(
        (transaction) => transaction.status === "completed" && transaction.type === "sale",
      );

      const salesTotal = completedSales.reduce((sum, transaction) => sum + transaction.final_amount, 0);
      const appointmentsCompleted = appointments.filter((appointment) => appointment.status === "completed").length;
      const appointmentsCancelled = appointments.filter((appointment) => appointment.status === "cancelled").length;

      const branchRevenue = Array.from(
        completedSales.reduce<Map<string, number>>((accumulator, transaction) => {
          const currentAmount = accumulator.get(transaction.branch_id) ?? 0;
          accumulator.set(transaction.branch_id, currentAmount + transaction.final_amount);
          return accumulator;
        }, new Map<string, number>()),
      )
        .map(([branchId, amount]) => ({
          label: branchLookup.get(branchId) ?? "Sucursal",
          value: formatCompactCurrency(amount),
          meta: amount.toString(),
        }))
        .sort((left, right) => Number(right.meta ?? 0) - Number(left.meta ?? 0))
        .slice(0, LIST_LIMIT)
        .map((item) => ({
          label: item.label,
          value: item.value,
          meta: formatCurrency(Number(item.meta ?? 0)),
        }));

      const saleTransactionIds = completedSales.map((transaction) => transaction.id);
      let topProducts: DashboardMetricItem[] = [];

      if (saleTransactionIds.length > 0) {
        const { data: transactionItems, error: transactionItemsError } = await supabase
          .from("transaction_items")
          .select("transaction_id, product_id, quantity, item_type")
          .eq("item_type", "product")
          .not("product_id", "is", null)
          .in("transaction_id", saleTransactionIds);

        if (transactionItemsError) {
          throw transactionItemsError;
        }

        const aggregatedProducts = (transactionItems ?? []).reduce<Map<string, number>>((accumulator, item) => {
          const productId = item.product_id;
          if (!productId) {
            return accumulator;
          }

          accumulator.set(productId, (accumulator.get(productId) ?? 0) + item.quantity);
          return accumulator;
        }, new Map<string, number>());

        const topProductIds = Array.from(aggregatedProducts.entries())
          .sort((left, right) => right[1] - left[1])
          .slice(0, LIST_LIMIT)
          .map(([productId]) => productId);

        if (topProductIds.length > 0) {
          const { data: products, error: productsError } = await supabase
            .from("products")
            .select("id, name, organization_id")
            .eq("organization_id", adminContext.organization_id)
            .in("id", topProductIds);

          if (productsError) {
            throw productsError;
          }

          const productNames = new Map((products ?? []).map((product) => [product.id, product.name]));
          topProducts = topProductIds.map((productId) => ({
            label: productNames.get(productId) ?? "Producto",
            value: `${aggregatedProducts.get(productId) ?? 0} uds`,
          }));
        }
      }

      const recentEmployeeIds = Array.from(new Set(recentTransactions.map((transaction) => transaction.employee_id)));
      let employeeLookup = new Map<string, string>();

      if (recentEmployeeIds.length > 0) {
        const { data: employees, error: employeesError } = await supabase
          .from("profiles")
          .select("id, full_name, organization_id")
          .eq("organization_id", adminContext.organization_id)
          .in("id", recentEmployeeIds);

        if (employeesError) {
          throw employeesError;
        }

        employeeLookup = new Map((employees ?? []).map((employee) => [employee.id, employee.full_name]));
      }

      const recentActivity = recentTransactions.map((transaction) => ({
        id: transaction.id,
        invoiceNumber: `#${transaction.invoice_number}`,
        branchName: branchLookup.get(transaction.branch_id) ?? "Sucursal",
        employeeName: employeeLookup.get(transaction.employee_id) ?? "Equipo",
        amount: transaction.final_amount,
        paymentMethod: titleCase(transaction.payment_method, "Sin método"),
        status: transaction.status ?? "unknown",
        type: transaction.type ?? "sale",
        createdAt: transaction.created_at ?? new Date().toISOString(),
      }));

      const productIdsInStock = Array.from(new Set(stockRows.map((row) => row.product_id)));
      let productLookup = new Map<string, Pick<ProductRow, "id" | "name" | "organization_id" | "track_inventory" | "is_active">>();

      if (productIdsInStock.length > 0) {
        const { data: products, error: productsError } = await supabase
          .from("products")
          .select("id, name, organization_id, track_inventory, is_active")
          .eq("organization_id", adminContext.organization_id)
          .in("id", productIdsInStock);

        if (productsError) {
          throw productsError;
        }

        productLookup = new Map((products ?? []).map((product) => [product.id, product]));
      }

      const stockAlerts = stockRows
        .map((row) => {
          const product = productLookup.get(row.product_id);
          if (!product || !product.track_inventory || !product.is_active) {
            return null;
          }

          const quantity = row.quantity ?? 0;
          const minStockLevel = row.min_stock_level ?? 0;
          if (quantity > minStockLevel) {
            return null;
          }

          return {
            stockId: row.id,
            productId: row.product_id,
            productName: product.name,
            branchName: branchLookup.get(row.branch_id) ?? "Sucursal",
            quantity,
            reservedQuantity: row.reserved_quantity ?? 0,
            minStockLevel,
            shortage: Math.max(minStockLevel - quantity, 0),
            updatedAt: row.updated_at,
          } satisfies DashboardStockAlert;
        })
        .filter((alert): alert is DashboardStockAlert => Boolean(alert))
        .sort((left, right) => right.shortage - left.shortage || left.quantity - right.quantity)
        .slice(0, STOCK_ALERT_LIMIT);

      const trendMap = new Map<string, number>();
      for (let offset = 0; offset < DEFAULT_TREND_DAYS; offset += 1) {
        const date = addDays(trendStartDate, offset);
        trendMap.set(date, 0);
      }

      trendTransactions.forEach((transaction) => {
        if (transaction.status !== "completed" || transaction.type !== "sale" || !transaction.created_at) {
          return;
        }

        const dateKey = createIsoDate(new Date(transaction.created_at));
        if (!trendMap.has(dateKey)) {
          return;
        }

        trendMap.set(dateKey, (trendMap.get(dateKey) ?? 0) + transaction.final_amount);
      });

      const trend = Array.from(trendMap.entries()).map(([date, amount]) => ({
        date,
        label: formatDateLabel(date),
        amount,
      }));

      return {
        organizationId: adminContext.organization_id,
        filters: normalizedFilters,
        branches,
        salesTotal,
        appointmentsCompleted,
        appointmentsCancelled,
        topProducts,
        branchRevenue,
        trend,
        recentActivity,
        stockAlerts,
        errorMessage: null,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudieron cargar las métricas del dashboard.";

      return createEmptyData(adminContext.organization_id, normalizedFilters, branches, message);
    }
  };

  const resolveAccountStatus = (
    organizationStatus: string | null,
    subscriptionStatus: string | null,
    validationStatus: string | null,
  ): DashboardAccountStatus => {
    if (organizationStatus === "suspended") {
      return "suspended";
    }

    if (organizationStatus === "active" && subscriptionStatus === "active") {
      return "active";
    }

    if (validationStatus === "rejected") {
      return "rejected";
    }

    return "pending";
  };

  const resolveSafeDestinationForRole = (role: ProfileRow["role"]): string => {
    return getDefaultPathForRole(role);
  };

  /**
   * Registra un intento de acceso a una funcionalidad bloqueada.
   */
  const logBlockedFeatureAttempt = async (payload: {
    featureKey: string;
    targetRoute: string;
    accountStatus: DashboardAccountStatus;
  }) => {
    if (!session.value?.user?.id) {
      return;
    }

    const { error: insertError } = await supabase.from("audit_logs").insert({
      action: "INSERT",
      table_name: "dashboard_blocked_features",
      record_id: pendingDashboard.value?.organization.id ?? null,
      user_id: session.value.user.id,
      context: {
        event: "BLOCKED_FEATURE_ATTEMPT",
        feature_key: payload.featureKey,
        target_route: payload.targetRoute,
        account_status: payload.accountStatus,
        organization_id: pendingDashboard.value?.organization.id ?? null,
      },
    });

    if (insertError && import.meta.dev) {
      console.warn("[DASHBOARD_AUDIT]", insertError.message);
    }
  };

  /**
   * Carga el resumen del dashboard limitado para cuentas aun no activas.
   */
  const loadLimitedDashboard = async (): Promise<LimitedDashboardData | null> => {
    pendingLoading.value = true;
    pendingError.value = null;

    try {
      const currentUser = await resolveUser();
      if (!currentUser) {
        throw createError({
          statusCode: 401,
          statusMessage: "Sesion no disponible.",
        });
      }

      const profile = await fetchProfile();
      if (!profile?.organization_id) {
        throw createError({
          statusCode: 403,
          statusMessage: "Tu usuario aun no tiene una organizacion asignada.",
        });
      }

      const [{ data: organization, error: organizationError }, {
        data: subscription,
        error: subscriptionError,
      }, {
        data: validation,
        error: validationError,
      }, productsResponse, employeesResponse, branchesResponse, servicesResponse] = await Promise.all([
        supabase
          .from("organizations")
          .select("id, name, country, status")
          .eq("id", profile.organization_id)
          .single(),
        supabase
          .from("organization_subscriptions")
          .select("status, current_period_end")
          .eq("organization_id", profile.organization_id)
          .maybeSingle(),
        supabase
          .from("payment_validations")
          .select("id, status, rejection_reason, created_at")
          .eq("organization_id", profile.organization_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", profile.organization_id),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", profile.organization_id)
          .in("role", ["admin", "manager", "employee"]),
        supabase
          .from("branches")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", profile.organization_id),
        supabase
          .from("services")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", profile.organization_id),
      ]);

      if (organizationError) {
        throw organizationError;
      }

      if (subscriptionError) {
        throw subscriptionError;
      }

      if (validationError) {
        throw validationError;
      }

      if (productsResponse.error) {
        throw productsResponse.error;
      }

      if (employeesResponse.error) {
        throw employeesResponse.error;
      }

      if (branchesResponse.error) {
        throw branchesResponse.error;
      }

      if (servicesResponse.error) {
        throw servicesResponse.error;
      }

      const capabilities = await loadCapabilities(profile.organization_id);
      const accountStatus = resolveAccountStatus(
        organization.status,
        subscription?.status ?? null,
        validation?.status ?? null,
      );

      const nextData: LimitedDashboardData = {
        profile: {
          id: profile.id,
          full_name: profile.full_name,
          role: profile.role,
          organization_id: profile.organization_id,
          email: profile.email,
        },
        organization,
        subscription,
        latestValidation: validation,
        accountStatus,
        stats: {
          sales: 0,
          appointments: 0,
          products: productsResponse.count ?? 0,
          employees: employeesResponse.count ?? 0,
          branches: branchesResponse.count ?? 0,
          services: servicesResponse.count ?? 0,
        },
        capabilities,
      };

      pendingDashboard.value = nextData;
      lastCheckedAt.value = new Date().toISOString();
      return nextData;
    } catch (error) {
      pendingError.value =
        error instanceof Error
          ? error.message
          : "No se pudo cargar el dashboard limitado.";
      pendingDashboard.value = null;
      return null;
    } finally {
      pendingLoading.value = false;
    }
  };

  /**
   * Reconsulta el estado de la cuenta y redirige cuando ya esta activa.
   */
  const refreshLimitedDashboardStatus = async () => {
    checkingStatus.value = true;

    try {
      const data = await loadLimitedDashboard();
      if (data?.accountStatus === "active") {
        await navigateTo(resolveSafeDestinationForRole(data.profile.role), {
          replace: true,
        });
      }

      return data;
    } finally {
      checkingStatus.value = false;
    }
  };

  const startLimitedDashboardPolling = () => {
    if (!import.meta.client || pendingPollingTimer) {
      return;
    }

    pendingPollingTimer = window.setInterval(async () => {
      await refreshLimitedDashboardStatus();
    }, 30000);
  };

  const stopLimitedDashboardPolling = () => {
    if (pendingPollingTimer) {
      window.clearInterval(pendingPollingTimer);
      pendingPollingTimer = null;
    }
  };

  const formattedPendingValidationDate = computed(() =>
    formatPendingDateLabel(pendingDashboard.value?.latestValidation?.created_at),
  );

  const formattedPendingPeriodEnd = computed(() =>
    formatPendingDateLabel(pendingDashboard.value?.subscription?.current_period_end),
  );

  const formattedLastCheckedAt = computed(() =>
    formatPendingDateLabel(lastCheckedAt.value),
  );

  if (import.meta.client) {
    onBeforeUnmount(() => {
      stopLimitedDashboardPolling();
    });
  }

  return {
    getDefaultFilters: normalizeFilters,
    loadDashboardData,
    formatCurrency,
    formatCompactCurrency,
    formatDateTimeLabel,
    pendingDashboard,
    pendingLoading,
    pendingError,
    checkingStatus,
    formattedPendingValidationDate,
    formattedPendingPeriodEnd,
    formattedLastCheckedAt,
    loadLimitedDashboard,
    refreshLimitedDashboardStatus,
    startLimitedDashboardPolling,
    stopLimitedDashboardPolling,
    logBlockedFeatureAttempt,
  };
};
