import type { Database, Json } from "@/types/database.types";
import type { OrganizationCapabilities } from "@/types/subscription";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type InventoryRow = Database["public"]["Tables"]["inventory_stock"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AssignmentRow =
  Database["public"]["Tables"]["employee_branch_assignments"]["Row"];
type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type SubscriptionRow =
  Database["public"]["Tables"]["organization_subscriptions"]["Row"];
type SubscriptionPlanRow =
  Database["public"]["Tables"]["subscription_plans"]["Row"];

export type BranchWeekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface BranchBusinessHour {
  isOpen: boolean;
  open: string;
  close: string;
}

export type BranchBusinessHours = Record<BranchWeekday, BranchBusinessHour>;

export interface BranchSettings {
  businessHours: BranchBusinessHours;
}

export interface BranchOption {
  label: string;
  value: string;
}

export interface BranchStats {
  salesTotal: number;
  salesCount: number;
  employeesCount: number;
  appointmentsCount: number;
  lowStockCount: number;
}

export interface BranchListItem {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  settings: BranchSettings;
  stats: BranchStats;
}

export interface BranchInventoryItem {
  stockId: string;
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minStockLevel: number;
}

export interface BranchMutationPayload {
  name: string;
  code: string;
  address: string;
  phone: string;
  settings: BranchSettings;
}

export interface BranchTransferPayload {
  sourceBranchId: string;
  destinationBranchId: string;
  productId: string;
  quantity: number;
  note?: string;
}

export interface BranchPlanFeatures {
  featureMultiBranch: boolean;
  featureInventoryTransfer: boolean;
}

export interface BranchesData {
  organizationId: string;
  branches: BranchListItem[];
  capabilities: OrganizationCapabilities | null;
  planFeatures: BranchPlanFeatures;
}

export interface BranchDetailsData {
  organizationId: string;
  branch: BranchListItem;
  destinationBranches: BranchOption[];
  inventory: BranchInventoryItem[];
  capabilities: OrganizationCapabilities | null;
  planFeatures: BranchPlanFeatures;
}

const weekdayOrder: BranchWeekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const createDefaultBusinessHours = (): BranchBusinessHours => ({
  monday: { isOpen: true, open: "09:00", close: "18:00" },
  tuesday: { isOpen: true, open: "09:00", close: "18:00" },
  wednesday: { isOpen: true, open: "09:00", close: "18:00" },
  thursday: { isOpen: true, open: "09:00", close: "18:00" },
  friday: { isOpen: true, open: "09:00", close: "18:00" },
  saturday: { isOpen: true, open: "09:00", close: "14:00" },
  sunday: { isOpen: false, open: "09:00", close: "13:00" },
});

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const readString = (value: unknown, fallback: string): string => {
  return typeof value === "string" && value.length > 0 ? value : fallback;
};

const readBoolean = (value: unknown, fallback: boolean): boolean => {
  return typeof value === "boolean" ? value : fallback;
};

const normalizeSettings = (value: Json | null): BranchSettings => {
  const defaults = createDefaultBusinessHours();
  const settings = isRecord(value) ? value : {};
  const businessHoursRaw = isRecord(settings.businessHours)
    ? settings.businessHours
    : {};

  const businessHours = weekdayOrder.reduce<BranchBusinessHours>(
    (accumulator, day) => {
      const source = isRecord(businessHoursRaw[day])
        ? businessHoursRaw[day]
        : {};
      const fallback = defaults[day];

      accumulator[day] = {
        isOpen: readBoolean(source.isOpen, fallback.isOpen),
        open: readString(source.open, fallback.open),
        close: readString(source.close, fallback.close),
      };

      return accumulator;
    },
    createDefaultBusinessHours(),
  );

  return { businessHours };
};

const serializeSettings = (settings: BranchSettings): Json => ({
  businessHours: weekdayOrder.reduce<Record<string, Json>>(
    (accumulator, day) => {
      accumulator[day] = {
        isOpen: settings.businessHours[day].isOpen,
        open: settings.businessHours[day].open,
        close: settings.businessHours[day].close,
      };
      return accumulator;
    },
    {},
  ),
});

const toBranchOption = (
  branch: Pick<BranchRow, "id" | "name" | "code">,
): BranchOption => ({
  label: `${branch.name} (${branch.code})`,
  value: branch.id,
});

const buildStatsMaps = (
  branchIds: string[],
  transactions: Array<Pick<TransactionRow, "branch_id" | "final_amount">>,
  appointments: Array<Pick<AppointmentRow, "id" | "branch_id">>,
  profiles: Array<Pick<ProfileRow, "id" | "branch_id" | "is_active">>,
  assignments: Array<Pick<AssignmentRow, "branch_id" | "user_id">>,
  inventory: Array<
    Pick<InventoryRow, "branch_id" | "quantity" | "min_stock_level">
  >,
) => {
  const salesMap = new Map<string, { total: number; count: number }>();
  const appointmentMap = new Map<string, number>();
  const employeeMap = new Map<string, Set<string>>();
  const lowStockMap = new Map<string, number>();

  for (const branchId of branchIds) {
    salesMap.set(branchId, { total: 0, count: 0 });
    appointmentMap.set(branchId, 0);
    employeeMap.set(branchId, new Set());
    lowStockMap.set(branchId, 0);
  }

  for (const transaction of transactions) {
    const current = salesMap.get(transaction.branch_id);
    if (!current) {
      continue;
    }

    current.total += transaction.final_amount ?? 0;
    current.count += 1;
  }

  for (const appointment of appointments) {
    appointmentMap.set(
      appointment.branch_id,
      (appointmentMap.get(appointment.branch_id) ?? 0) + 1,
    );
  }

  for (const profile of profiles) {
    if (profile.is_active === false || !profile.branch_id) {
      continue;
    }

    employeeMap.get(profile.branch_id)?.add(profile.id);
  }

  for (const assignment of assignments) {
    employeeMap.get(assignment.branch_id)?.add(assignment.user_id);
  }

  for (const row of inventory) {
    const quantity = row.quantity ?? 0;
    const minStockLevel = row.min_stock_level ?? 0;

    if (quantity <= minStockLevel) {
      lowStockMap.set(row.branch_id, (lowStockMap.get(row.branch_id) ?? 0) + 1);
    }
  }

  return {
    salesMap,
    appointmentMap,
    employeeMap,
    lowStockMap,
  };
};

export const useBranches = () => {
  const supabase = useSupabaseClient<Database>();
  const { resolveAccessToken } = useSessionAccess();
  const { profile, fetchProfile } = useAuth();
  const { loadCapabilities, getUpgradeMessage, canCreateResource } =
    useSubscription();

  const getAuthHeaders = async () => {
    const token = await resolveAccessToken();
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage:
          "La sesión no está disponible para gestionar sucursales.",
      });
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const getAdminOrganizationId = async (): Promise<string> => {
    const currentProfile = profile.value ?? (await fetchProfile());
    if (!currentProfile?.organization_id || currentProfile.role !== "admin") {
      throw createError({
        statusCode: 403,
        statusMessage: "Solo administradores pueden gestionar sucursales.",
      });
    }

    return currentProfile.organization_id;
  };

  const loadPlanFeatures = async (
    organizationId: string,
  ): Promise<BranchPlanFeatures> => {
    const { data: subscription, error: subscriptionError } = await supabase
      .from("organization_subscriptions")
      .select("plan_id")
      .eq("organization_id", organizationId)
      .in("status", ["active", "trial"])
      .gt("current_period_end", new Date().toISOString())
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle<Pick<SubscriptionRow, "plan_id">>();

    if (subscriptionError) {
      throw createError({
        statusCode: 500,
        statusMessage: subscriptionError.message,
      });
    }

    if (!subscription?.plan_id) {
      return {
        featureInventoryTransfer: false,
        featureMultiBranch: false,
      };
    }

    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("feature_multi_branch, feature_inventory_transfer")
      .eq("id", subscription.plan_id)
      .maybeSingle<
        Pick<
          SubscriptionPlanRow,
          "feature_multi_branch" | "feature_inventory_transfer"
        >
      >();

    if (planError) {
      throw createError({
        statusCode: 500,
        statusMessage: planError.message,
      });
    }

    return {
      featureInventoryTransfer: plan?.feature_inventory_transfer ?? false,
      featureMultiBranch: plan?.feature_multi_branch ?? false,
    };
  };

  const loadBranches = async (): Promise<BranchesData> => {
    const organizationId = await getAdminOrganizationId();
    const loadedCapabilities = await loadCapabilities(organizationId);
    const planFeatures = await loadPlanFeatures(organizationId);

    const { data: branches, error: branchesError } = await supabase
      .from("branches")
      .select(
        "id, organization_id, name, code, address, phone, settings, is_active, created_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });

    if (branchesError) {
      throw createError({
        statusCode: 500,
        statusMessage: branchesError.message,
      });
    }

    const branchRows = branches ?? [];
    const branchIds = branchRows.map((branch) => branch.id);

    if (branchIds.length === 0) {
      return {
        organizationId,
        branches: [],
        capabilities: loadedCapabilities,
        planFeatures,
      };
    }

    const [
      transactionsResult,
      appointmentsResult,
      profilesResult,
      assignmentsResult,
      inventoryResult,
    ] = await Promise.all([
      supabase
        .from("transactions")
        .select("branch_id, final_amount")
        .eq("organization_id", organizationId)
        .in("branch_id", branchIds),
      supabase
        .from("appointments")
        .select("id, branch_id")
        .eq("organization_id", organizationId)
        .in("branch_id", branchIds),
      supabase
        .from("profiles")
        .select("id, branch_id, is_active")
        .eq("organization_id", organizationId)
        .neq("role", "client"),
      supabase
        .from("employee_branch_assignments")
        .select("branch_id, user_id")
        .in("branch_id", branchIds),
      supabase
        .from("inventory_stock")
        .select("branch_id, quantity, min_stock_level")
        .in("branch_id", branchIds),
    ]);

    const firstError =
      transactionsResult.error ??
      appointmentsResult.error ??
      profilesResult.error ??
      assignmentsResult.error ??
      inventoryResult.error;

    if (firstError) {
      throw createError({
        statusCode: 500,
        statusMessage: firstError.message,
      });
    }

    const { salesMap, appointmentMap, employeeMap, lowStockMap } =
      buildStatsMaps(
        branchIds,
        transactionsResult.data ?? [],
        appointmentsResult.data ?? [],
        profilesResult.data ?? [],
        assignmentsResult.data ?? [],
        inventoryResult.data ?? [],
      );

    const branchList = branchRows.map<BranchListItem>((branch) => {
      const sales = salesMap.get(branch.id) ?? { total: 0, count: 0 };

      return {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        address: branch.address,
        phone: branch.phone,
        isActive: branch.is_active ?? true,
        createdAt: branch.created_at,
        updatedAt: branch.updated_at,
        settings: normalizeSettings(branch.settings),
        stats: {
          salesTotal: sales.total,
          salesCount: sales.count,
          employeesCount: employeeMap.get(branch.id)?.size ?? 0,
          appointmentsCount: appointmentMap.get(branch.id) ?? 0,
          lowStockCount: lowStockMap.get(branch.id) ?? 0,
        },
      };
    });

    return {
      organizationId,
      branches: branchList,
      capabilities: loadedCapabilities,
      planFeatures,
    };
  };

  const loadBranchDetails = async (
    branchId: string,
  ): Promise<BranchDetailsData> => {
    const organizationId = await getAdminOrganizationId();
    const loadedCapabilities = await loadCapabilities(organizationId);
    const planFeatures = await loadPlanFeatures(organizationId);

    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select(
        "id, organization_id, name, code, address, phone, settings, is_active, created_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .eq("id", branchId)
      .maybeSingle<BranchRow>();

    if (branchError) {
      throw createError({
        statusCode: 500,
        statusMessage: branchError.message,
      });
    }

    if (!branch) {
      throw createError({
        statusCode: 404,
        statusMessage: "La sucursal solicitada no existe.",
      });
    }

    const [
      transactionsResult,
      appointmentsResult,
      profilesResult,
      assignmentsResult,
      inventoryResult,
      destinationBranchesResult,
    ] = await Promise.all([
      supabase
        .from("transactions")
        .select("branch_id, final_amount")
        .eq("organization_id", organizationId)
        .eq("branch_id", branchId),
      supabase
        .from("appointments")
        .select("id, branch_id")
        .eq("organization_id", organizationId)
        .eq("branch_id", branchId),
      supabase
        .from("profiles")
        .select("id, branch_id, is_active")
        .eq("organization_id", organizationId)
        .neq("role", "client"),
      supabase
        .from("employee_branch_assignments")
        .select("branch_id, user_id")
        .eq("branch_id", branchId),
      supabase
        .from("inventory_stock")
        .select(
          "id, branch_id, product_id, quantity, reserved_quantity, min_stock_level, updated_at",
        )
        .eq("branch_id", branchId),
      supabase
        .from("branches")
        .select("id, name, code, is_active")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .neq("id", branchId)
        .order("name", { ascending: true }),
    ]);

    const firstError =
      transactionsResult.error ??
      appointmentsResult.error ??
      profilesResult.error ??
      assignmentsResult.error ??
      inventoryResult.error ??
      destinationBranchesResult.error;

    if (firstError) {
      throw createError({
        statusCode: 500,
        statusMessage: firstError.message,
      });
    }

    const inventoryRows = inventoryResult.data ?? [];
    const productIds = Array.from(
      new Set(inventoryRows.map((item) => item.product_id)),
    );

    let productLookup = new Map<
      string,
      Pick<ProductRow, "id" | "name" | "sku">
    >();
    if (productIds.length > 0) {
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("organization_id", organizationId)
        .in("id", productIds);

      if (productsError) {
        throw createError({
          statusCode: 500,
          statusMessage: productsError.message,
        });
      }

      productLookup = new Map(
        (products ?? []).map((product) => [product.id, product]),
      );
    }

    const { salesMap, appointmentMap, employeeMap, lowStockMap } =
      buildStatsMaps(
        [branchId],
        transactionsResult.data ?? [],
        appointmentsResult.data ?? [],
        profilesResult.data ?? [],
        assignmentsResult.data ?? [],
        inventoryRows,
      );

    const sales = salesMap.get(branchId) ?? { total: 0, count: 0 };

    const detailBranch: BranchListItem = {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address,
      phone: branch.phone,
      isActive: branch.is_active ?? true,
      createdAt: branch.created_at,
      updatedAt: branch.updated_at,
      settings: normalizeSettings(branch.settings),
      stats: {
        salesTotal: sales.total,
        salesCount: sales.count,
        employeesCount: employeeMap.get(branchId)?.size ?? 0,
        appointmentsCount: appointmentMap.get(branchId) ?? 0,
        lowStockCount: lowStockMap.get(branchId) ?? 0,
      },
    };

    const inventory = inventoryRows
      .map<BranchInventoryItem>((item) => {
        const product = productLookup.get(item.product_id);
        const quantity = item.quantity ?? 0;
        const reservedQuantity = item.reserved_quantity ?? 0;

        return {
          stockId: item.id,
          productId: item.product_id,
          productName: product?.name ?? "Producto",
          sku: product?.sku ?? null,
          quantity,
          reservedQuantity,
          availableQuantity: quantity - reservedQuantity,
          minStockLevel: item.min_stock_level ?? 0,
        };
      })
      .sort((left, right) =>
        left.productName.localeCompare(right.productName, "es"),
      );

    return {
      organizationId,
      branch: detailBranch,
      destinationBranches: (destinationBranchesResult.data ?? []).map((item) =>
        toBranchOption(item),
      ),
      inventory,
      capabilities: loadedCapabilities,
      planFeatures,
    };
  };

  const createBranch = async (payload: BranchMutationPayload) => {
    return await $fetch("/api/admin/branches", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: {
        ...payload,
        settings: serializeSettings(payload.settings),
      },
    });
  };

  const updateBranch = async (
    branchId: string,
    payload: BranchMutationPayload,
  ) => {
    return await $fetch(`/api/admin/branches/${branchId}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: {
        ...payload,
        settings: serializeSettings(payload.settings),
      },
    });
  };

  const updateBranchStatus = async (branchId: string, isActive: boolean) => {
    try {
      const result = await $fetch(`/api/admin/branches/${branchId}/status`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: { isActive },
      });
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("Failed to update branch status:", error);
      throw new Error(
        `No se pudo actualizar el estado de la sucursal: ${message}`,
      );
    }
  };

  const transferStock = async (payload: BranchTransferPayload) => {
    return await $fetch("/api/admin/branches/transfer-stock", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: {
        ...payload,
        note: payload.note?.trim() ?? "",
      },
    });
  };

  const branchLimitMessage = computed(() => getUpgradeMessage("branch"));

  const canCreateMoreBranches = computed(() => canCreateResource("branch"));

  const getMultiBranchMessage = (data: {
    capabilities: OrganizationCapabilities | null;
    planFeatures: BranchPlanFeatures;
  }) => {
    if (
      (data.capabilities?.currentBranchesCount ?? 0) < 1 ||
      data.planFeatures.featureMultiBranch
    ) {
      return null;
    }

    return "Tu plan actual solo permite operar con una sucursal activa. Actualiza tu suscripción para habilitar multi-sucursal.";
  };

  const getTransferUpgradeMessage = (data: {
    capabilities: OrganizationCapabilities | null;
    planFeatures: BranchPlanFeatures;
  }) => {
    if (
      data.planFeatures.featureInventoryTransfer &&
      data.capabilities?.canTransferStock
    ) {
      return null;
    }

    return "La transferencia de stock entre sucursales requiere un plan con inventario transferible habilitado.";
  };

  return {
    weekdayOrder,
    createDefaultBusinessHours,
    loadBranches,
    loadBranchDetails,
    createBranch,
    updateBranch,
    updateBranchStatus,
    transferStock,
    branchLimitMessage,
    canCreateMoreBranches,
    getMultiBranchMessage,
    getTransferUpgradeMessage,
  };
};
