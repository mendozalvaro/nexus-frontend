import { createError } from "h3";

import type { InventoryContext } from "../../utils/inventory";
import { getInventoryCategories } from "./categories";
import type { InventoryCategory } from "./categories";
import type { InventoryProductRowView, InventoryLowStockItem, InventoryBranchOption } from "./overview";

export interface InventoryProductsData {
  organizationId: string;
  role: "admin" | "manager";
  canTransferStock: boolean;
  branches: InventoryBranchOption[];
  categories: InventoryCategory[];
  products: InventoryProductRowView[];
  lowStock: InventoryLowStockItem[];
}

const mapBranch = (branch: { id: string; name: string; code: string | null; address: string | null; is_active: boolean }): InventoryBranchOption => ({
  id: branch.id,
  name: branch.name,
  code: branch.code ?? "--",
  address: branch.address,
  isActive: branch.is_active ?? true,
});

export const getInventoryProductsPage = async (context: InventoryContext): Promise<InventoryProductsData> => {
  const branchIds = context.role === "admin" ? null : context.allowedBranchIds;

  const [branchesResult, productsResult, categoriesResult] = await Promise.all([
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
      .returns<Array<{
        id: string;
        organization_id: string;
        name: string;
        sku: string | null;
        description: string | null;
        category_id: string | null;
        cost_price: number;
        sale_price: number;
        track_inventory: boolean;
        is_active: boolean;
        created_at: string | null;
        updated_at: string | null;
      }>>(),
    getInventoryCategories(context),
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

  let stockData: Array<{
    id: string;
    branch_id: string;
    product_id: string;
    quantity: number | null;
    reserved_quantity: number | null;
    min_stock_level: number | null;
    updated_at: string | null;
  }> = [];
  
  if (branchIds && branchIds.length > 0) {
    const stockResult = await context.adminClient
      .from("inventory_stock")
      .select("id, branch_id, product_id, quantity, reserved_quantity, min_stock_level, updated_at")
      .in("branch_id", branchIds);
    
    if (stockResult.error) {
      throw createError({ statusCode: 500, statusMessage: stockResult.error.message });
    }
    stockData = stockResult.data ?? [];
  }

  const stockByProduct = new Map<string, typeof stockData>();
  for (const stock of stockData) {
    const existing = stockByProduct.get(stock.product_id) ?? [];
    existing.push(stock);
    stockByProduct.set(stock.product_id, existing);
  }

  const lowStock: InventoryLowStockItem[] = [];

  const mappedProducts: InventoryProductRowView[] = products.map((product) => {
    const productStocks = stockByProduct.get(product.id) ?? [];
    
    const stocks = productStocks.map((stock) => {
      const branch = branchMap.get(stock.branch_id);
      const quantity = stock.quantity ?? 0;
      const reservedQuantity = stock.reserved_quantity ?? 0;
      const availableQuantity = quantity - reservedQuantity;
      const minStockLevel = stock.min_stock_level ?? 0;
      const isLowStock = quantity <= minStockLevel;

      if (product.track_inventory && isLowStock) {
        lowStock.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          branchId: stock.branch_id,
          branchName: branch?.name ?? "Sucursal",
          branchCode: branch?.code ?? "--",
          quantity,
          minStockLevel,
          availableQuantity,
        });
      }

      return {
        stockId: stock.id,
        branchId: stock.branch_id,
        branchName: branch?.name ?? "Sucursal",
        branchCode: branch?.code ?? "--",
        quantity,
        reservedQuantity,
        availableQuantity,
        minStockLevel,
        isLowStock,
        updatedAt: stock.updated_at,
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

  return {
    organizationId: context.organizationId,
    role: context.role,
    canTransferStock: context.canTransferStock,
    branches,
    categories: categoriesResult,
    products: mappedProducts,
    lowStock,
  };
};