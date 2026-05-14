import { requirePOSContext } from "../../utils/pos";

import type { H3Event } from "h3";

export interface POSProductWithStock {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  sale_price: number | null;
  is_active: boolean | null;
  track_inventory: boolean | null;
  stock: number | null;
}

export interface POSProductsResult {
  products: POSProductWithStock[];
}

export async function getPOSProducts(
  event: H3Event,
  branchId: string | null,
): Promise<POSProductsResult> {
  const context = await requirePOSContext(event);

  if (branchId) {
    const { allowedBranchIds } = context;
    if (!allowedBranchIds.includes(branchId)) {
      throw createError({
        statusCode: 403,
        statusMessage: "No tienes acceso a la sucursal indicada.",
      });
    }
  }

  const { data: products, error: productsError } = await context.adminClient
    .from("products")
    .select("id, name, sku, category_id, sale_price, is_active, track_inventory")
    .eq("organization_id", context.organizationId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (productsError) {
    throw createError({ statusCode: 500, statusMessage: productsError.message });
  }

  let stockByProductId: Record<string, number> = {};
  if (branchId) {
    const { data: stockRows, error: stockError } = await context.adminClient
      .from("inventory_stock")
      .select("product_id, quantity")
      .eq("branch_id", branchId)
      .in("product_id", (products ?? []).map((product) => product.id));

    if (stockError) {
      throw createError({ statusCode: 500, statusMessage: stockError.message });
    }

    stockByProductId = Object.fromEntries((stockRows ?? []).map((row) => [row.product_id, Number(row.quantity ?? 0)]));
  }

  return {
    products: (products ?? []).map((product) => ({
      ...product,
      stock: branchId ? (stockByProductId[product.id] ?? 0) : null,
    })),
  };
}
