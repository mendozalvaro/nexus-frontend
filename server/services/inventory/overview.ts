import { createError } from "h3";

import type { InventoryContext } from "../../utils/inventory";
import { getInventoryMovements } from "./stock";
import type { InventoryStockWithProduct } from "./stock";
import type { InventoryProductRow } from "./products";
import { getInventoryCategories, type InventoryCategory } from "./categories";

export interface InventoryBranchOption {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
}

interface InventoryProductStockItem {
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

interface InventoryMovementRowView {
  id: string;
  organizationId: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  productId: string;
  productName: string;
  sku: string | null;
  movementType: "entry" | "exit" | "adjustment" | "transfer_in" | "transfer_out";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  referenceCode: string | null;
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
  role: "admin" | "manager";
  canTransferStock: boolean;
  branches: InventoryBranchOption[];
  categories: InventoryCategory[];
  products: InventoryProductRowView[];
  lowStock: InventoryLowStockItem[];
  recentMovements: InventoryMovementRowView[];
  metrics: InventoryOverviewMetrics;
}

const getTodayLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const mapBranch = (branch: { id: string; name: string; code: string | null; address: string | null; is_active: boolean }): InventoryBranchOption => ({
  id: branch.id,
  name: branch.name,
  code: branch.code ?? "--",
  address: branch.address,
  isActive: branch.is_active ?? true,
});

export const getInventoryOverview = async (context: InventoryContext): Promise<InventoryOverviewData> => {
  const branchIds = context.role === "admin" ? null : context.allowedBranchIds;

  const [branchesResult, productsResult, categoriesResult, todayMovementsResult] = await Promise.all([
    context.adminClient
      .from("branches")
      .select("id, name, code, address, is_active")
      .eq("organization_id", context.organizationId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<Array<{ id: string; name: string; code: string | null; address: string | null; is_active: boolean }>>(),
    context.adminClient
      .from("products")
      .select("*")
      .eq("organization_id", context.organizationId)
      .order("name", { ascending: true })
      .returns<InventoryProductRow[]>(),
    getInventoryCategories(context),
    getInventoryMovements(context, {
      branchIds: branchIds ?? undefined,
      filters: {
        branchId: null,
        productId: null,
        movementType: "all",
        dateFrom: getTodayLocalDate(),
        dateTo: getTodayLocalDate(),
      },
      limit: 200,
    }),
  ]);

  if (branchesResult.error) {
    throw createError({ statusCode: 500, statusMessage: branchesResult.error.message });
  }
  if (productsResult.error) {
    throw createError({ statusCode: 500, statusMessage: productsResult.error.message });
  }

  const branches = (branchesResult.data ?? []).map(mapBranch);
  const branchMap = new Map(branches.map((b) => [b.id, b]));

  const products = productsResult.data ?? [];
  const categoryMap = new Map(categoriesResult.map((c) => [c.id, c]));

  let stockData: InventoryStockWithProduct[] = [];
  const stockBranchIds = branchIds ?? branches.map((b) => b.id);
  if (stockBranchIds.length > 0) {
    const stockResult = await context.adminClient
      .from("inventory_stock")
      .select("id, branch_id, product_id, quantity, reserved_quantity, min_stock_level, updated_at")
      .in("branch_id", stockBranchIds);
    
    if (stockResult.error) {
      throw createError({ statusCode: 500, statusMessage: stockResult.error.message });
    }

    const productIds = Array.from(new Set((stockResult.data ?? []).map((s) => s.product_id)));
    if (productIds.length > 0) {
      const productsInStockResult = await context.adminClient
        .from("products")
        .select("id, name, sku")
        .eq("organization_id", context.organizationId)
        .in("id", productIds);
      
      const productMap = new Map((productsInStockResult.data ?? []).map((p) => [p.id, p]));
      
      stockData = (stockResult.data ?? []).map((stock) => {
        const product = productMap.get(stock.product_id);
        const quantity = stock.quantity ?? 0;
        const reservedQuantity = stock.reserved_quantity ?? 0;
        
        return {
          id: stock.id,
          branchId: stock.branch_id,
          productId: stock.product_id,
          quantity,
          reservedQuantity,
          availableQuantity: quantity - reservedQuantity,
          minStockLevel: stock.min_stock_level ?? 0,
          updatedAt: stock.updated_at,
          productName: product?.name ?? "Producto",
          sku: product?.sku ?? null,
        };
      });
    }
  }

  const stockByProduct = new Map<string, InventoryStockWithProduct[]>();
  for (const stock of stockData) {
    const existing = stockByProduct.get(stock.productId) ?? [];
    existing.push(stock);
    stockByProduct.set(stock.productId, existing);
  }

  const lowStock: InventoryLowStockItem[] = [];

  const mappedProducts: InventoryProductRowView[] = products.map((product) => {
    const productStocks = stockByProduct.get(product.id) ?? [];
    
    const stocks: InventoryProductStockItem[] = productStocks.map((stock) => {
      const branch = branchMap.get(stock.branchId);
      const quantity = stock.quantity;
      const reservedQuantity = stock.reservedQuantity;
      const availableQuantity = quantity - reservedQuantity;
      const minStockLevel = stock.minStockLevel;
      const isLowStock = quantity <= minStockLevel;

      if (product.track_inventory && isLowStock) {
        lowStock.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          branchId: stock.branchId,
          branchName: branch?.name ?? "Sucursal",
          branchCode: branch?.code ?? "--",
          quantity,
          minStockLevel,
          availableQuantity,
        });
      }

      return {
        stockId: stock.id,
        branchId: stock.branchId,
        branchName: branch?.name ?? "Sucursal",
        branchCode: branch?.code ?? "--",
        quantity,
        reservedQuantity,
        availableQuantity,
        minStockLevel,
        isLowStock,
        updatedAt: stock.updatedAt,
      };
    }).sort((a, b) => a.branchName.localeCompare(b.branchName, "es"));

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
      totalQuantity: stocks.reduce((sum, s) => sum + s.quantity, 0),
      totalReservedQuantity: stocks.reduce((sum, s) => sum + s.reservedQuantity, 0),
      totalAvailableQuantity: stocks.reduce((sum, s) => sum + s.availableQuantity, 0),
      lowStockBranchesCount: stocks.filter((s) => s.isLowStock).length,
    };
  });

  lowStock.sort((a, b) => {
    if (a.branchName === b.branchName) {
      return a.productName.localeCompare(b.productName, "es");
    }
    return a.branchName.localeCompare(b.branchName, "es");
  });

  const mappedMovements: InventoryMovementRowView[] = todayMovementsResult.map((m) => ({
    id: m.id,
    organizationId: context.organizationId,
    branchId: m.branchId,
    branchName: m.branchName,
    branchCode: branchMap.get(m.branchId)?.code ?? "--",
    productId: m.productId,
    productName: m.productName,
    sku: m.sku,
    movementType: m.movementType,
    quantity: m.quantity,
    previousQuantity: m.previousQuantity,
    newQuantity: m.newQuantity,
    referenceCode: m.referenceCode,
    reason: m.reason,
    note: m.note,
    referenceType: m.referenceType,
    referenceId: m.referenceId,
    sourceBranchId: m.sourceBranchId,
    sourceBranchName: m.sourceBranchId ? branchMap.get(m.sourceBranchId)?.name ?? null : null,
    destinationBranchId: m.destinationBranchId,
    destinationBranchName: m.destinationBranchId ? branchMap.get(m.destinationBranchId)?.name ?? null : null,
    createdAt: m.createdAt,
    createdBy: m.createdBy,
    createdByName: m.createdByName,
  })).slice(0, 10);

  const activeCategories = categoriesResult.filter((c) => c.isActive);

  return {
    organizationId: context.organizationId,
    role: context.role,
    canTransferStock: context.canTransferStock,
    branches,
    categories: categoriesResult,
    products: mappedProducts,
    lowStock,
    recentMovements: mappedMovements,
    metrics: {
      totalProducts: mappedProducts.length,
      activeProducts: mappedProducts.filter((p) => p.isActive).length,
      totalCategories: categoriesResult.length,
      activeCategories: activeCategories.length,
      totalUnits: mappedProducts.reduce((sum, p) => sum + p.totalQuantity, 0),
      lowStockItems: lowStock.length,
      movementsToday: todayMovementsResult.length,
    },
  };
};
