import { createError } from "h3";

import type { InventoryContext } from "../../utils/inventory";
import { getInventoryMovements } from "./stock";
import { getInventoryProductsPage } from "./products-page";

type MovementType = "entry" | "exit" | "adjustment" | "transfer_in" | "transfer_out";

interface InventoryMovementFilters {
  branchId: string | null;
  productId: string | null;
  movementType: MovementType | "all";
  dateFrom: string | null;
  dateTo: string | null;
}

interface InventoryBranchOption {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
}

export interface InventoryHistoryData {
  organizationId: string;
  role: "admin" | "manager";
  canTransferStock: boolean;
  branches: InventoryBranchOption[];
  products: any[];
  movements: any[];
}

const mapBranch = (branch: { id: string; name: string; code: string | null; address: string | null; is_active: boolean }): InventoryBranchOption => ({
  id: branch.id,
  name: branch.name,
  code: branch.code ?? "--",
  address: branch.address,
  isActive: branch.is_active ?? true,
});

export const getInventoryHistoryPage = async (
  context: InventoryContext,
  filters?: Partial<InventoryMovementFilters>,
): Promise<InventoryHistoryData> => {
  const branchIds = context.role === "admin" ? null : context.allowedBranchIds;

  const [branchesResult, movementsResult, productsData] = await Promise.all([
    context.adminClient
      .from("branches")
      .select("id, name, code, address, is_active")
      .eq("organization_id", context.organizationId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<Array<{ id: string; name: string; code: string | null; address: string | null; is_active: boolean }>>(),
    getInventoryMovements(context, {
      branchIds: branchIds ?? undefined,
      filters: {
        branchId: filters?.branchId ?? null,
        productId: filters?.productId ?? null,
        movementType: filters?.movementType ?? "all",
        dateFrom: filters?.dateFrom ?? null,
        dateTo: filters?.dateTo ?? null,
      },
      limit: 200,
    }),
    context.role === "admin" || context.allowedBranchIds.length > 0
      ? getInventoryProductsPage(context)
      : Promise.resolve(null),
  ]);

  if (branchesResult.error) {
    throw createError({ statusCode: 500, statusMessage: branchesResult.error.message });
  }

  const branches = (branchesResult.data ?? []).map(mapBranch);

  return {
    organizationId: context.organizationId,
    role: context.role,
    canTransferStock: context.canTransferStock,
    branches,
    products: productsData?.products ?? [],
    movements: movementsResult,
  };
};