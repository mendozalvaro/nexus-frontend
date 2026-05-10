import { createError } from "h3";

import type { InventoryContext } from "../../utils/inventory";

export interface InventoryStockRow {
  id: string;
  organization_id: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  reserved_quantity: number;
  min_stock_level: number;
  updated_at: string | null;
}

export interface InventoryStockItem {
  id: string;
  branchId: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minStockLevel: number;
  updatedAt: string | null;
}

export interface InventoryStockWithProduct extends InventoryStockItem {
  productName: string;
  sku: string | null;
}

export const getInventoryStock = async (
  context: InventoryContext,
  options: { branchIds?: string[] | null }
): Promise<InventoryStockWithProduct[]> => {
  let query = context.adminClient
    .from("inventory_stock")
    .select("id, branch_id, product_id, quantity, reserved_quantity, min_stock_level, updated_at")
    .order("updated_at", { ascending: false });

  if (options.branchIds && options.branchIds.length > 0) {
    query = query.in("branch_id", options.branchIds);
  } else if (options.branchIds !== null && context.role !== "admin") {
    return [];
  }

  const { data: stockData, error: stockError } = await query;
  if (stockError) {
    throw createError({ statusCode: 500, statusMessage: stockError.message });
  }

  if (!stockData || stockData.length === 0) {
    return [];
  }

  const productIds = Array.from(new Set(stockData.map((s) => s.product_id)));
  const { data: productsData, error: productsError } = await context.adminClient
    .from("products")
    .select("id, name, sku")
    .eq("organization_id", context.organizationId)
    .in("id", productIds);

  if (productsError) {
    throw createError({ statusCode: 500, statusMessage: productsError.message });
  }

  const productMap = new Map((productsData ?? []).map((p) => [p.id, p]));

  return stockData.map((stock) => {
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
};

export const getInventoryStockByBranch = async (
  context: InventoryContext,
  branchId: string
): Promise<InventoryStockWithProduct[]> => {
  return getInventoryStock(context, { branchIds: [branchId] });
};

export interface InventoryMovementRow {
  id: string;
  organization_id: string;
  branch_id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reference_code: string | null;
  reason: string | null;
  note: string | null;
  reference_type: string | null;
  reference_id: string | null;
  source_branch_id: string | null;
  destination_branch_id: string | null;
  created_at: string | null;
  created_by: string | null;
}

export type MovementType = "entry" | "exit" | "adjustment" | "transfer_in" | "transfer_out";

export interface InventoryMovement {
  id: string;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  sku: string | null;
  movementType: MovementType;
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

export interface InventoryMovementFilters {
  branchId: string | null;
  productId: string | null;
  movementType: MovementType | "all";
  dateFrom: string | null;
  dateTo: string | null;
}

export function mapMovementType(value: string): MovementType {
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
}

export const getInventoryMovements = async (
  context: InventoryContext,
  options: {
    branchIds?: string[];
    filters?: Partial<InventoryMovementFilters>;
    limit?: number;
  }
): Promise<InventoryMovement[]> => {
  let query = context.adminClient
    .from("inventory_movements")
    .select("*")
    .eq("organization_id", context.organizationId)
    .order("created_at", { ascending: false });

  const { branchIds, filters, limit = 200 } = options;

  if (branchIds && branchIds.length > 0) {
    query = query.in("branch_id", branchIds);
  }

  if (filters?.productId) {
    query = query.eq("product_id", filters.productId);
  }

  if (filters?.movementType && filters.movementType !== "all") {
    query = query.eq("movement_type", filters.movementType);
  }

  if (filters?.dateFrom) {
    const start = new Date(`${filters.dateFrom}T00:00:00`).toISOString();
    query = query.gte("created_at", start);
  }

  if (filters?.dateTo) {
    const end = new Date(`${filters.dateTo}T23:59:59.999`).toISOString();
    query = query.lte("created_at", end);
  }

  query = query.limit(limit);

  const { data: movementRows, error } = await query.returns<InventoryMovementRow[]>();
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  if (!movementRows || movementRows.length === 0) {
    return [];
  }

  const productIds = Array.from(new Set(movementRows.map((m) => m.product_id)));
  const createdByIds = Array.from(
    new Set(movementRows.map((m) => m.created_by).filter((id): id is string => Boolean(id)))
  );
  const branchIdsSet = Array.from(
    new Set(
      movementRows.flatMap((m) => [
        m.branch_id,
        m.source_branch_id,
        m.destination_branch_id,
      ].filter((id): id is string => Boolean(id)))
    )
  );

  const [productsResult, profilesResult, branchesResult] = await Promise.all([
    productIds.length > 0
      ? context.adminClient.from("products").select("id, name, sku").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    createdByIds.length > 0
      ? context.adminClient.from("profiles").select("id, full_name").in("id", createdByIds)
      : Promise.resolve({ data: [], error: null }),
    branchIdsSet.length > 0
      ? context.adminClient.from("branches").select("id, name, code").in("id", branchIdsSet)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const firstError = productsResult.error ?? profilesResult.error ?? branchesResult.error;
  if (firstError) {
    throw createError({ statusCode: 500, statusMessage: firstError.message });
  }

  const productMap = new Map((productsResult.data ?? []).map((p) => [p.id, p]));
  const profileMap = new Map((profilesResult.data ?? []).map((p) => [p.id, p]));
  const branchMap = new Map((branchesResult.data ?? []).map((b) => [b.id, b]));

  return movementRows.map((row) => ({
    id: row.id,
    branchId: row.branch_id,
    branchName: branchMap.get(row.branch_id)?.name ?? "Sucursal",
    productId: row.product_id,
    productName: productMap.get(row.product_id)?.name ?? "Producto",
    sku: productMap.get(row.product_id)?.sku ?? null,
    movementType: mapMovementType(row.movement_type),
    quantity: row.quantity,
    previousQuantity: row.previous_quantity,
    newQuantity: row.new_quantity,
    referenceCode: row.reference_code,
    reason: row.reason,
    note: row.note,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    sourceBranchId: row.source_branch_id,
    sourceBranchName: row.source_branch_id ? branchMap.get(row.source_branch_id)?.name ?? null : null,
    destinationBranchId: row.destination_branch_id,
    destinationBranchName: row.destination_branch_id
      ? branchMap.get(row.destination_branch_id)?.name ?? null
      : null,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByName: row.created_by ? profileMap.get(row.created_by)?.full_name ?? null : null,
  }));
};
