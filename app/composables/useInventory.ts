import type { Database } from "@/types/database.types";
import type { OrganizationCapabilities } from "@/types/subscription";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type InventoryMovementRow = Database["public"]["Tables"]["inventory_movements"]["Row"];
type InventoryStockRow = Database["public"]["Tables"]["inventory_stock"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];

type InventoryRole = Extract<Database["public"]["Enums"]["user_role"], "admin" | "manager">;
type MovementType = "entry" | "exit" | "adjustment" | "transfer_in" | "transfer_out";

export interface InventoryBranchOption {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
}

export interface InventoryCategoryItem {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  isActive: boolean;
  productsCount: number;
}

export interface InventoryProductStockItem {
  stockId: string | null;
  branchId: string;
  branchName: string;
  branchCode: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minStockLevel: number;
  isLowStock: boolean;
  updatedAt: string | null;
}

export interface InventoryProductRowView {
  id: string;
  organizationId: string;
  name: string;
  sku: string | null;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  costPrice: number;
  salePrice: number;
  trackInventory: boolean;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  stockByBranch: InventoryProductStockItem[];
  totalQuantity: number;
  totalReservedQuantity: number;
  totalAvailableQuantity: number;
  lowStockBranchesCount: number;
}

export interface InventoryLowStockItem {
  productId: string;
  productName: string;
  sku: string | null;
  branchId: string;
  branchName: string;
  branchCode: string;
  quantity: number;
  minStockLevel: number;
  availableQuantity: number;
}

export interface InventoryMovementRowView {
  id: string;
  organizationId: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  productId: string;
  productName: string;
  sku: string | null;
  movementType: MovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string | null;
  note: string | null;
  referenceType: string | null;
  referenceId: string | null;
  sourceBranchId: string | null;
  sourceBranchName: string | null;
  destinationBranchId: string | null;
  destinationBranchName: string | null;
  createdAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
}

export interface InventoryOverviewMetrics {
  totalProducts: number;
  activeProducts: number;
  totalCategories: number;
  activeCategories: number;
  totalUnits: number;
  lowStockItems: number;
  movementsToday: number;
}

export interface InventoryOverviewData {
  organizationId: string;
  role: InventoryRole;
  capabilities: OrganizationCapabilities | null;
  branches: InventoryBranchOption[];
  categories: InventoryCategoryItem[];
  products: InventoryProductRowView[];
  lowStock: InventoryLowStockItem[];
  recentMovements: InventoryMovementRowView[];
  transferEnabled: boolean;
  metrics: InventoryOverviewMetrics;
}

export interface InventoryProductsData {
  organizationId: string;
  role: InventoryRole;
  capabilities: OrganizationCapabilities | null;
  branches: InventoryBranchOption[];
  categories: InventoryCategoryItem[];
  products: InventoryProductRowView[];
  lowStock: InventoryLowStockItem[];
  transferEnabled: boolean;
}

export interface InventoryAdjustmentsData {
  organizationId: string;
  role: InventoryRole;
  capabilities: OrganizationCapabilities | null;
  branches: InventoryBranchOption[];
  products: InventoryProductRowView[];
  movements: InventoryMovementRowView[];
  transferEnabled: boolean;
}

export interface InventoryCategoryPayload {
  name: string;
  parentId: string | null;
}

export interface InventoryProductPayload {
  name: string;
  sku: string;
  description: string;
  costPrice: number;
  salePrice: number;
  categoryId: string | null;
  trackInventory: boolean;
}

export interface InventoryAdjustmentPayload {
  branchId: string;
  productId: string;
  mode: "set" | "add" | "remove";
  quantity: number;
  minStockLevel?: number | null;
  reason: string;
  note?: string;
}

export interface InventoryTransferPayload {
  sourceBranchId: string;
  destinationBranchId: string;
  productId: string;
  quantity: number;
  reason: string;
  note?: string;
}

export interface InventoryMovementFilters {
  branchId: string | null;
  productId: string | null;
  movementType: MovementType | "all";
  dateFrom: string | null;
  dateTo: string | null;
}

interface InventoryContext {
  organizationId: string;
  role: InventoryRole;
  branches: InventoryBranchOption[];
  branchMap: Map<string, InventoryBranchOption>;
  capabilities: OrganizationCapabilities | null;
  allowedBranchIds: string[];
}

const movementLabels: Record<MovementType, string> = {
  adjustment: "Ajuste",
  entry: "Entrada",
  exit: "Salida",
  transfer_in: "Transferencia entrada",
  transfer_out: "Transferencia salida",
};

const getTodayLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateRange = (dateFrom: string | null, dateTo: string | null) => {
  if (!dateFrom && !dateTo) {
    return null;
  }

  const start = dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : null;
  const end = dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : null;

  return { start, end };
};

const mapBranch = (branch: Pick<BranchRow, "id" | "name" | "code" | "address" | "is_active">): InventoryBranchOption => ({
  id: branch.id,
  name: branch.name,
  code: branch.code,
  address: branch.address,
  isActive: branch.is_active ?? true,
});

const getMovementType = (value: string): MovementType => {
  switch (value) {
    case "entry":
    case "exit":
    case "adjustment":
    case "transfer_in":
    case "transfer_out":
      return value;
    default:
      return "adjustment";
  }
};

const toAuthHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const useInventory = () => {
  const supabase = useSupabaseClient<Database>();
  const { resolveAccessToken } = useSessionAccess();
  const { profile, fetchProfile } = useAuth();
  const { loadCapabilities, getUpgradeMessage } = useSubscription();

  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const ensureProfile = async () => {
    return profile.value ?? await fetchProfile();
  };

  const getAccessToken = async () => {
    const token = await resolveAccessToken();
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: "La sesión no está disponible para gestionar inventario.",
      });
    }

    return token;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-BO", {
      style: "currency",
      currency: "BOB",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDateTime = (value: string | null) => {
    if (!value) {
      return "Sin registro";
    }

    return new Intl.DateTimeFormat("es-BO", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: localTimeZone,
    }).format(new Date(value));
  };

  const getMovementLabel = (movementType: MovementType) => {
    return movementLabels[movementType];
  };

  const getMovementColor = (movementType: MovementType): "success" | "warning" | "error" | "primary" | "neutral" => {
    switch (movementType) {
      case "entry":
      case "transfer_in":
        return "success";
      case "exit":
      case "transfer_out":
        return "warning";
      case "adjustment":
        return "primary";
      default:
        return "neutral";
    }
  };

  const getStockTone = (quantity: number, minStockLevel: number): "success" | "warning" | "error" | "neutral" => {
    if (quantity <= 0) {
      return "error";
    }

    if (quantity <= minStockLevel) {
      return "warning";
    }

    return "success";
  };

  const loadInventoryContext = async (): Promise<InventoryContext> => {
    const currentProfile = await ensureProfile();
    if (!currentProfile?.organization_id || (currentProfile.role !== "admin" && currentProfile.role !== "manager")) {
      throw createError({
        statusCode: 403,
        statusMessage: "Solo administradores y managers pueden acceder al módulo de inventario.",
      });
    }

    const organizationId = currentProfile.organization_id;
    const role: InventoryRole = currentProfile.role;
    const capabilities = await loadCapabilities(organizationId);

    if (role === "admin") {
      const { data: branches, error } = await supabase
        .from("branches")
        .select("id, name, code, address, is_active")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true });

      if (error) {
        throw createError({
          statusCode: 500,
          statusMessage: error.message,
        });
      }

      const mappedBranches = (branches ?? []).map(mapBranch);

      return {
        organizationId,
        role,
        capabilities,
        branches: mappedBranches,
        branchMap: new Map(mappedBranches.map((branch) => [branch.id, branch])),
        allowedBranchIds: mappedBranches.map((branch) => branch.id),
      };
    }

    const { data: assignments, error: assignmentsError } = await supabase
      .from("employee_branch_assignments")
      .select("branch_id")
      .eq("user_id", currentProfile.id)
      .returns<Array<Pick<AssignmentRow, "branch_id">>>();

    if (assignmentsError) {
      throw createError({
        statusCode: 500,
        statusMessage: assignmentsError.message,
      });
    }

    const allowedBranchIds = Array.from(new Set((assignments ?? []).map((assignment) => assignment.branch_id)));

    if (allowedBranchIds.length === 0) {
      return {
        organizationId,
        role,
        capabilities,
        branches: [],
        branchMap: new Map(),
        allowedBranchIds: [],
      };
    }

    const { data: branches, error: branchesError } = await supabase
      .from("branches")
      .select("id, name, code, address, is_active")
      .eq("organization_id", organizationId)
      .in("id", allowedBranchIds)
      .order("name", { ascending: true });

    if (branchesError) {
      throw createError({
        statusCode: 500,
        statusMessage: branchesError.message,
      });
    }

    const mappedBranches = (branches ?? []).map(mapBranch);

    return {
      organizationId,
      role,
      capabilities,
      branches: mappedBranches,
      branchMap: new Map(mappedBranches.map((branch) => [branch.id, branch])),
      allowedBranchIds: mappedBranches.map((branch) => branch.id),
    };
  };

  const loadCategoriesInternal = async (
    organizationId: string,
    products: ProductRow[],
  ): Promise<InventoryCategoryItem[]> => {
    const { data: categories, error } = await supabase
      .from("categories")
      .select("id, name, parent_id, is_active")
      .eq("organization_id", organizationId)
      .eq("type", "product")
      .order("name", { ascending: true });

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message,
      });
    }

    const categoryRows = categories ?? [];
    const categoryMap = new Map(categoryRows.map((category) => [category.id, category]));
    const countMap = new Map<string, number>();

    for (const product of products) {
      if (!product.category_id) {
        continue;
      }

      countMap.set(product.category_id, (countMap.get(product.category_id) ?? 0) + 1);
    }

    return categoryRows.map((category) => ({
      id: category.id,
      name: category.name,
      parentId: category.parent_id,
      parentName: category.parent_id ? categoryMap.get(category.parent_id)?.name ?? null : null,
      isActive: category.is_active ?? true,
      productsCount: countMap.get(category.id) ?? 0,
    }));
  };

  const loadProductsInternal = async (
    context: InventoryContext,
  ): Promise<{ products: InventoryProductRowView[]; lowStock: InventoryLowStockItem[]; categories: InventoryCategoryItem[] }> => {
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*")
      .eq("organization_id", context.organizationId)
      .order("name", { ascending: true });

    if (productsError) {
      throw createError({
        statusCode: 500,
        statusMessage: productsError.message,
      });
    }

    const productRows = products ?? [];
    const categories = await loadCategoriesInternal(context.organizationId, productRows);
    const categoryMap = new Map(categories.map((category) => [category.id, category]));

    const { data: stockRows, error: stockError } = context.allowedBranchIds.length > 0
      ? await supabase
          .from("inventory_stock")
          .select("id, branch_id, product_id, quantity, reserved_quantity, min_stock_level, updated_at")
          .in("branch_id", context.allowedBranchIds)
      : { data: [] as Array<Pick<InventoryStockRow, "id" | "branch_id" | "product_id" | "quantity" | "reserved_quantity" | "min_stock_level" | "updated_at">>, error: null };

    if (stockError) {
      throw createError({
        statusCode: 500,
        statusMessage: stockError.message,
      });
    }

    const stockMap = new Map<string, Array<Pick<InventoryStockRow, "id" | "branch_id" | "product_id" | "quantity" | "reserved_quantity" | "min_stock_level" | "updated_at">>>();
    for (const row of stockRows ?? []) {
      const current = stockMap.get(row.product_id) ?? [];
      current.push(row);
      stockMap.set(row.product_id, current);
    }

    const lowStock: InventoryLowStockItem[] = [];

    const mappedProducts = productRows.map<InventoryProductRowView>((product) => {
      const stocks = (stockMap.get(product.id) ?? [])
        .map<InventoryProductStockItem>((row) => {
          const branch = context.branchMap.get(row.branch_id);
          const quantity = row.quantity ?? 0;
          const reservedQuantity = row.reserved_quantity ?? 0;
          const availableQuantity = quantity - reservedQuantity;
          const minStockLevel = row.min_stock_level ?? 0;
          const stockItem: InventoryProductStockItem = {
            stockId: row.id,
            branchId: row.branch_id,
            branchName: branch?.name ?? "Sucursal",
            branchCode: branch?.code ?? "--",
            quantity,
            reservedQuantity,
            availableQuantity,
            minStockLevel,
            isLowStock: quantity <= minStockLevel,
            updatedAt: row.updated_at,
          };

          if (product.track_inventory && stockItem.isLowStock) {
            lowStock.push({
              productId: product.id,
              productName: product.name,
              sku: product.sku,
              branchId: stockItem.branchId,
              branchName: stockItem.branchName,
              branchCode: stockItem.branchCode,
              quantity,
              minStockLevel,
              availableQuantity,
            });
          }

          return stockItem;
        })
        .sort((left, right) => left.branchName.localeCompare(right.branchName, "es"));

      return {
        id: product.id,
        organizationId: product.organization_id,
        name: product.name,
        sku: product.sku,
        description: product.description,
        categoryId: product.category_id,
        categoryName: product.category_id ? categoryMap.get(product.category_id)?.name ?? null : null,
        costPrice: product.cost_price ?? 0,
        salePrice: product.sale_price,
        trackInventory: product.track_inventory ?? true,
        isActive: product.is_active ?? true,
        createdAt: product.created_at,
        updatedAt: product.updated_at,
        stockByBranch: stocks,
        totalQuantity: stocks.reduce((sum, stock) => sum + stock.quantity, 0),
        totalReservedQuantity: stocks.reduce((sum, stock) => sum + stock.reservedQuantity, 0),
        totalAvailableQuantity: stocks.reduce((sum, stock) => sum + stock.availableQuantity, 0),
        lowStockBranchesCount: stocks.filter((stock) => stock.isLowStock).length,
      };
    });

    return {
      categories,
      products: mappedProducts,
      lowStock: lowStock.sort((left, right) => {
        if (left.branchName === right.branchName) {
          return left.productName.localeCompare(right.productName, "es");
        }

        return left.branchName.localeCompare(right.branchName, "es");
      }),
    };
  };

  const loadMovementsInternal = async (
    context: InventoryContext,
    filters?: Partial<InventoryMovementFilters>,
  ): Promise<InventoryMovementRowView[]> => {
    let query = supabase
      .from("inventory_movements")
      .select("*")
      .eq("organization_id", context.organizationId)
      .order("created_at", { ascending: false })
      .limit(200);

    const branchIds = filters?.branchId ? [filters.branchId] : context.allowedBranchIds;
    if (branchIds.length > 0) {
      query = query.in("branch_id", branchIds);
    }

    if (filters?.productId) {
      query = query.eq("product_id", filters.productId);
    }

    if (filters?.movementType && filters.movementType !== "all") {
      query = query.eq("movement_type", filters.movementType);
    }

    const range = toDateRange(filters?.dateFrom ?? null, filters?.dateTo ?? null);
    if (range?.start) {
      query = query.gte("created_at", range.start);
    }

    if (range?.end) {
      query = query.lte("created_at", range.end);
    }

    const { data: movementRows, error } = await query.returns<InventoryMovementRow[]>();
    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message,
      });
    }

    const rows = movementRows ?? [];
    if (rows.length === 0) {
      return [];
    }

    const productIds = Array.from(new Set(rows.map((row) => row.product_id)));
    const createdByIds = Array.from(new Set(rows.map((row) => row.created_by).filter((value): value is string => Boolean(value))));
    const relatedBranchIds = Array.from(
      new Set(
        rows.flatMap((row) => [row.branch_id, row.source_branch_id, row.destination_branch_id].filter((value): value is string => Boolean(value))),
      ),
    );

    const [productsResult, profilesResult, branchesResult] = await Promise.all([
      productIds.length > 0
        ? supabase
            .from("products")
            .select("id, name, sku")
            .eq("organization_id", context.organizationId)
            .in("id", productIds)
        : Promise.resolve({ data: [], error: null }),
      createdByIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, full_name")
            .eq("organization_id", context.organizationId)
            .in("id", createdByIds)
        : Promise.resolve({ data: [], error: null }),
      relatedBranchIds.length > 0
        ? supabase
            .from("branches")
            .select("id, name, code, address, is_active")
            .eq("organization_id", context.organizationId)
            .in("id", relatedBranchIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const firstError = productsResult.error ?? profilesResult.error ?? branchesResult.error;
    if (firstError) {
      throw createError({
        statusCode: 500,
        statusMessage: firstError.message,
      });
    }

    const productMap = new Map((productsResult.data ?? []).map((product) => [product.id, product]));
    const profileMap = new Map((profilesResult.data ?? []).map((item) => [item.id, item]));
    const branchMap = new Map((branchesResult.data ?? []).map((branch) => [branch.id, mapBranch(branch)]));

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      branchId: row.branch_id,
      branchName: branchMap.get(row.branch_id)?.name ?? "Sucursal",
      branchCode: branchMap.get(row.branch_id)?.code ?? "--",
      productId: row.product_id,
      productName: productMap.get(row.product_id)?.name ?? "Producto",
      sku: productMap.get(row.product_id)?.sku ?? null,
      movementType: getMovementType(row.movement_type),
      quantity: row.quantity,
      previousQuantity: row.previous_quantity,
      newQuantity: row.new_quantity,
      reason: row.reason,
      note: row.note,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      sourceBranchId: row.source_branch_id,
      sourceBranchName: row.source_branch_id ? branchMap.get(row.source_branch_id)?.name ?? null : null,
      destinationBranchId: row.destination_branch_id,
      destinationBranchName: row.destination_branch_id ? branchMap.get(row.destination_branch_id)?.name ?? null : null,
      createdAt: row.created_at,
      createdBy: row.created_by,
      createdByName: row.created_by ? profileMap.get(row.created_by)?.full_name ?? null : null,
    }));
  };

  const loadOverview = async (): Promise<InventoryOverviewData> => {
    const context = await loadInventoryContext();
    const [{ products, lowStock, categories }, recentMovements] = await Promise.all([
      loadProductsInternal(context),
      loadMovementsInternal(context, {
        dateFrom: getTodayLocalDate(),
        dateTo: getTodayLocalDate(),
      }),
    ]);

    return {
      organizationId: context.organizationId,
      role: context.role,
      capabilities: context.capabilities,
      branches: context.branches,
      categories,
      products,
      lowStock,
      recentMovements: recentMovements.slice(0, 10),
      transferEnabled: context.capabilities?.canTransferStock ?? false,
      metrics: {
        totalProducts: products.length,
        activeProducts: products.filter((product) => product.isActive).length,
        totalCategories: categories.length,
        activeCategories: categories.filter((category) => category.isActive).length,
        totalUnits: products.reduce((sum, product) => sum + product.totalQuantity, 0),
        lowStockItems: lowStock.length,
        movementsToday: recentMovements.length,
      },
    };
  };

  const loadProductsPage = async (): Promise<InventoryProductsData> => {
    const context = await loadInventoryContext();
    const { products, lowStock, categories } = await loadProductsInternal(context);

    return {
      organizationId: context.organizationId,
      role: context.role,
      capabilities: context.capabilities,
      branches: context.branches,
      categories,
      products,
      lowStock,
      transferEnabled: context.capabilities?.canTransferStock ?? false,
    };
  };

  const loadAdjustmentsPage = async (filters?: Partial<InventoryMovementFilters>): Promise<InventoryAdjustmentsData> => {
    const context = await loadInventoryContext();
    const [{ products }, movements] = await Promise.all([
      loadProductsInternal(context),
      loadMovementsInternal(context, filters),
    ]);

    return {
      organizationId: context.organizationId,
      role: context.role,
      capabilities: context.capabilities,
      branches: context.branches,
      products,
      movements,
      transferEnabled: context.capabilities?.canTransferStock ?? false,
    };
  };

  const createProduct = async (payload: InventoryProductPayload) => {
    return await $fetch<{ success: boolean; productId: string }>("/api/inventory/products", {
      method: "POST",
      headers: toAuthHeaders(await getAccessToken()),
      body: payload,
    });
  };

  const updateProduct = async (productId: string, payload: InventoryProductPayload) => {
    return await $fetch<{ success: boolean; productId: string }>(`/api/inventory/products/${productId}`, {
      method: "PATCH",
      headers: toAuthHeaders(await getAccessToken()),
      body: payload,
    });
  };

  const updateProductStatus = async (productId: string, isActive: boolean) => {
    return await $fetch<{ success: boolean; productId: string }>(`/api/inventory/products/${productId}/status`, {
      method: "POST",
      headers: toAuthHeaders(await getAccessToken()),
      body: { isActive },
    });
  };

  const createCategory = async (payload: InventoryCategoryPayload) => {
    return await $fetch<{ success: boolean; categoryId: string }>("/api/inventory/categories", {
      method: "POST",
      headers: toAuthHeaders(await getAccessToken()),
      body: payload,
    });
  };

  const updateCategory = async (categoryId: string, payload: InventoryCategoryPayload) => {
    return await $fetch<{ success: boolean; categoryId: string }>(`/api/inventory/categories/${categoryId}`, {
      method: "PATCH",
      headers: toAuthHeaders(await getAccessToken()),
      body: payload,
    });
  };

  const updateCategoryStatus = async (categoryId: string, isActive: boolean) => {
    return await $fetch<{ success: boolean; categoryId: string }>(`/api/inventory/categories/${categoryId}/status`, {
      method: "POST",
      headers: toAuthHeaders(await getAccessToken()),
      body: { isActive },
    });
  };

  const adjustStock = async (payload: InventoryAdjustmentPayload) => {
    return await $fetch<{ success: boolean; stockId: string | null; movementId: string | null }>("/api/inventory/stock/adjust", {
      method: "POST",
      headers: toAuthHeaders(await getAccessToken()),
      body: payload,
    });
  };

  const transferStock = async (payload: InventoryTransferPayload) => {
    return await $fetch<{ success: boolean }>("/api/inventory/stock/transfer", {
      method: "POST",
      headers: toAuthHeaders(await getAccessToken()),
      body: payload,
    });
  };

  const createDefaultMovementFilters = (): InventoryMovementFilters => ({
    branchId: null,
    productId: null,
    movementType: "all",
    dateFrom: getTodayLocalDate(),
    dateTo: getTodayLocalDate(),
  });

  const getTransferUpgradeMessage = (capabilities: OrganizationCapabilities | null) => {
    if (capabilities?.canTransferStock) {
      return null;
    }

    return getUpgradeMessage("branch") ??
      "Tu plan actual no incluye transferencias de inventario entre sucursales.";
  };

  return {
    localTimeZone,
    createDefaultMovementFilters,
    loadOverview,
    loadProductsPage,
    loadAdjustmentsPage,
    createCategory,
    updateCategory,
    updateCategoryStatus,
    createProduct,
    updateProduct,
    updateProductStatus,
    adjustStock,
    transferStock,
    formatCurrency,
    formatDateTime,
    getMovementLabel,
    getMovementColor,
    getStockTone,
    getTransferUpgradeMessage,
  };
};

