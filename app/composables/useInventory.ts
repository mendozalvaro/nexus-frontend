import type { OrganizationCapabilities } from "@/types/subscription";
import type {
  InventoryOverviewData,
  InventoryProductsData,
  InventoryAdjustmentsData,
  InventoryHistoryData,
  InventoryCategoryPayload,
  InventoryProductPayload,
  InventoryAdjustmentPayload,
  InventoryTransferPayload,
  InventoryTransferFilters,
  InventoryMovementFilters,
  InventoryTransferDetailData,
} from "@/utils/inventory";

const toAuthHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const useInventory = () => {
  const { resolveAccessToken } = useSessionAccess();
  const { getUpgradeMessage } = useSubscription();

  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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

  const { formatCurrency: formatCurrencyUtil, formatDateTime: formatDateTimeUtil, getMovementLabel, getMovementColor, getStockTone, normalizeInventoryAdjustmentBatchPayload, normalizeInventoryTransferBatchPayload } = useUtilsInventory();

  const loadOverview = async (): Promise<InventoryOverviewData> => {
    const accessToken = await getAccessToken();
    
    const result = await $fetch<InventoryOverviewData>("/api/inventory/overview", {
      headers: toAuthHeaders(accessToken),
    });

    return {
      ...result,
      transferEnabled: result.canTransferStock,
    };
  };

  const loadProductsPage = async (): Promise<InventoryProductsData> => {
    const accessToken = await getAccessToken();
    
    const result = await $fetch<InventoryProductsData>("/api/inventory/products-page", {
      headers: toAuthHeaders(accessToken),
    });

    return {
      ...result,
      transferEnabled: result.canTransferStock,
    };
  };

  const loadTransfersPage = async (
    filters?: Partial<InventoryTransferFilters>,
    options: { includeProducts?: boolean } = {},
  ): Promise<InventoryAdjustmentsData> => {
    const accessToken = await getAccessToken();
    const includeProducts = options.includeProducts !== false;

    const result = await $fetch<InventoryAdjustmentsData>("/api/inventory/transfers-page", {
      headers: toAuthHeaders(accessToken),
      query: {
        branchId: filters?.branchId ?? undefined,
        productId: filters?.productId ?? undefined,
        status: filters?.status ?? "all",
        includeProducts: includeProducts.toString(),
      },
    });

    return {
      ...result,
      transferEnabled: result.canTransferStock,
    };
  };

  const loadHistoryPage = async (filters?: Partial<InventoryMovementFilters>): Promise<InventoryHistoryData> => {
    const accessToken = await getAccessToken();

    const result = await $fetch<InventoryHistoryData>("/api/inventory/history-page", {
      headers: toAuthHeaders(accessToken),
      query: {
        branchId: filters?.branchId ?? undefined,
        productId: filters?.productId ?? undefined,
        movementType: filters?.movementType ?? "all",
        dateFrom: filters?.dateFrom ?? undefined,
        dateTo: filters?.dateTo ?? undefined,
      },
    });

    return {
      ...result,
      canTransferStock: result.canTransferStock,
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
    return await $fetch<{ success: boolean; transferId: string; status: string }>("/api/inventory/stock/transfer", {
      method: "POST",
      headers: toAuthHeaders(await getAccessToken()),
      body: payload,
    });
  };

  const receiveTransfer = async (transferId: string) => {
    return await $fetch<{ success: boolean; transferId: string; status: string; idempotent?: boolean }>(
      `/api/inventory/stock/transfer/${transferId}/receive`,
      {
        method: "POST",
        headers: toAuthHeaders(await getAccessToken()),
      },
    );
  };

  const rejectTransfer = async (transferId: string) => {
    return await $fetch<{ success: boolean; transferId: string; status: string; idempotent?: boolean }>(
      `/api/inventory/stock/transfer/${transferId}/cancel`,
      {
        method: "POST",
        headers: toAuthHeaders(await getAccessToken()),
      },
    );
  };

  const precheckAdjustStockBatch = async (payload: InventoryAdjustmentBatchPayload) => {
    const normalized = normalizeInventoryAdjustmentBatchPayload(
      payload.branchId,
      payload.mode,
      payload.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    );

    return await $fetch<{
      success: boolean;
      isValid: boolean;
      errors: InventoryBatchValidationError[];
      rows?: InventoryBatchValidationError[];
    } & InventoryBatchApiMeta<InventoryAdjustmentBatchLine>>(
      "/api/inventory/stock/adjust/batch/precheck",
      {
        method: "POST",
        headers: toAuthHeaders(await getAccessToken()),
        body: normalized.normalized,
      },
    );
  };

  const adjustStockBatch = async (payload: InventoryAdjustmentBatchPayload) => {
    const normalized = normalizeInventoryAdjustmentBatchPayload(
      payload.branchId,
      payload.mode,
      payload.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    );

    return await $fetch<{
      success: boolean;
      batchId: string;
      processedCount: number;
      idempotent: boolean;
    } & InventoryBatchApiMeta<InventoryAdjustmentBatchLine>>(
      "/api/inventory/stock/adjust/batch",
      {
        method: "POST",
        headers: toAuthHeaders(await getAccessToken()),
        body: normalized.normalized,
      },
    );
  };

  const precheckTransferStockBatch = async (payload: InventoryTransferBatchPayload) => {
    const normalized = normalizeInventoryTransferBatchPayload(
      payload.sourceBranchId,
      payload.destinationBranchId,
      payload.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    );

    return await $fetch<{
      success: boolean;
      isValid: boolean;
      errors: InventoryBatchValidationError[];
      rows?: InventoryBatchValidationError[];
    } & InventoryBatchApiMeta<InventoryTransferBatchLine>>(
      "/api/inventory/stock/transfer/batch/precheck",
      {
        method: "POST",
        headers: toAuthHeaders(await getAccessToken()),
        body: normalized.normalized,
      },
    );
  };

  const transferStockBatch = async (payload: InventoryTransferBatchPayload) => {
    const normalized = normalizeInventoryTransferBatchPayload(
      payload.sourceBranchId,
      payload.destinationBranchId,
      payload.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    );

    return await $fetch<{
      success: boolean;
      batchId: string;
      processedCount: number;
      idempotent: boolean;
      status: string;
    } & InventoryBatchApiMeta<InventoryTransferBatchLine>>(
      "/api/inventory/stock/transfer/batch",
      {
        method: "POST",
        headers: toAuthHeaders(await getAccessToken()),
        body: normalized.normalized,
      },
    );
  };

  const receiveTransferBatch = async (batchId: string) => {
    return await $fetch<{ success: boolean; batchId: string; processedCount: number; idempotent?: boolean; status: string }>(
      `/api/inventory/stock/transfer-batch/${batchId}/receive`,
      {
        method: "POST",
        headers: toAuthHeaders(await getAccessToken()),
      },
    );
  };

  const rejectTransferBatch = async (batchId: string) => {
    return await $fetch<{ success: boolean; batchId: string; processedCount: number; idempotent?: boolean; status: string }>(
      `/api/inventory/stock/transfer-batch/${batchId}/cancel`,
      {
        method: "POST",
        headers: toAuthHeaders(await getAccessToken()),
      },
    );
  };

  const loadTransferDetails = async (transferId: string) => {
    return await $fetch<{
      success: boolean;
      details: InventoryTransferDetailData;
    }>(`/api/inventory/stock/transfer-details/${transferId}`, {
      method: "GET",
      headers: toAuthHeaders(await getAccessToken()),
    });
  };

  const createDefaultTransferFilters = (): InventoryTransferFilters => ({
    branchId: null,
    productId: null,
    status: "all",
  });

  const createDefaultMovementFilters = (): InventoryMovementFilters => ({
    branchId: null,
    productId: null,
    movementType: "all",
    dateFrom: null,
    dateTo: null,
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
    createDefaultTransferFilters,
    createDefaultMovementFilters,
    loadOverview,
    loadProductsPage,
    loadTransfersPage,
    loadHistoryPage,
    createCategory,
    updateCategory,
    updateCategoryStatus,
    createProduct,
    updateProduct,
    updateProductStatus,
    adjustStock,
    precheckAdjustStockBatch,
    adjustStockBatch,
    transferStock,
    precheckTransferStockBatch,
    transferStockBatch,
    receiveTransfer,
    receiveTransferBatch,
    rejectTransfer,
    rejectTransferBatch,
    loadTransferDetails,
    formatCurrency: formatCurrencyUtil,
    formatDateTime: (value: string | null) => formatDateTimeUtil(value, localTimeZone),
    getMovementLabel,
    getMovementColor,
    getStockTone,
    getTransferUpgradeMessage,
  };
};