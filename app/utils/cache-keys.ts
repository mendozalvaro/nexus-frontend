export const CACHE_KEYS = {
  initialData: "initial-data",
  organization: "organization",
  profile: "profile",
  subscription: "subscription",
  branches: "branches",
  dashboardStats: "dashboard-stats",
  posProducts: "pos-products",
  inventoryStock: "inventory-stock",
} as const;

export const dashboardStatsKey = (params: {
  organizationId?: string | null;
  branchId?: string | null;
  period: "7d" | "30d" | "90d";
}) => {
  const orgPart = params.organizationId ?? "none";
  const branchPart = params.branchId ?? "all";
  return `${CACHE_KEYS.dashboardStats}-${orgPart}-${branchPart}-${params.period}`;
};

export const posProductsKey = (branchId?: string | null) => `${CACHE_KEYS.posProducts}-${branchId ?? "all"}`;
export const inventoryStockKey = (branchId?: string | null) => `${CACHE_KEYS.inventoryStock}-${branchId ?? "all"}`;
