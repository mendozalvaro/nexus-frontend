import { createError } from "h3";

import type { InventoryContext } from "../../utils/inventory";
import { buildStatsMaps, normalizeSettings, type BranchListItem } from "./list";

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

export interface BranchOption {
  label: string;
  value: string;
}

function toBranchOption(branch: { id: string; name: string; code: string | null }): BranchOption {
  return {
    label: branch.name,
    value: branch.id,
  };
}

export const getBranchDetails = async (context: InventoryContext, branchId: string) => {
  const { data: branch, error: branchError } = await context.adminClient
    .from("branches")
    .select("id, organization_id, name, code, address, phone, settings, is_active, created_at, updated_at")
    .eq("organization_id", context.organizationId)
    .eq("id", branchId)
    .maybeSingle();

  if (branchError) {
    throw createError({ statusCode: 500, statusMessage: branchError.message });
  }

  if (!branch) {
    throw createError({ statusCode: 404, statusMessage: "La sucursal solicitada no existe." });
  }

  const [
    transactionsResult,
    appointmentsResult,
    profilesResult,
    assignmentsResult,
    inventoryResult,
    destinationBranchesResult,
  ] = await Promise.all([
    context.adminClient.from("transactions").select("branch_id, final_amount")
      .eq("organization_id", context.organizationId).eq("branch_id", branchId),
    context.adminClient.from("appointments").select("id, branch_id")
      .eq("organization_id", context.organizationId).eq("branch_id", branchId),
    context.adminClient.from("profiles").select("id, is_active, role")
      .eq("organization_id", context.organizationId).neq("role", "client"),
    context.adminClient.from("employee_branch_assignments").select("branch_id, user_id")
      .eq("branch_id", branchId),
    context.adminClient.from("inventory_stock").select(
      "id, branch_id, product_id, quantity, reserved_quantity, min_stock_level, updated_at"
    ).eq("branch_id", branchId),
    context.adminClient.from("branches").select("id, name, code, is_active")
      .eq("organization_id", context.organizationId).eq("is_active", true)
      .neq("id", branchId).order("name", { ascending: true }),
  ]);

  const firstError = transactionsResult.error ?? appointmentsResult.error
    ?? profilesResult.error ?? assignmentsResult.error ?? inventoryResult.error
    ?? destinationBranchesResult.error;

  if (firstError) {
    throw createError({ statusCode: 500, statusMessage: firstError.message });
  }

  const inventoryRows = inventoryResult.data ?? [];
  const productIds = Array.from(new Set(inventoryRows.map((item) => item.product_id)));

  let productLookup = new Map<string, { id: string; name: string; sku: string | null }>();
  if (productIds.length > 0) {
    const { data: products, error: productsError } = await context.adminClient
      .from("products")
      .select("id, name, sku")
      .eq("organization_id", context.organizationId)
      .in("id", productIds);

    if (productsError) {
      throw createError({ statusCode: 500, statusMessage: productsError.message });
    }

    productLookup = new Map((products ?? []).map((p) => [p.id, p]));
  }

  const { salesMap, appointmentMap, employeeMap, lowStockMap } = buildStatsMaps(
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
    settings: normalizeSettings(branch.settings as unknown),
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
    .sort((left, right) => left.productName.localeCompare(right.productName, "es"));

  return {
    branch: detailBranch,
    destinationBranches: (destinationBranchesResult.data ?? []).map((item) => toBranchOption(item)),
    inventory,
  };
};
