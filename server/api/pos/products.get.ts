import { createError, getQuery } from "h3";

import { setCacheHeaders } from "../../utils/cache";
import { assertBranchAccess, requirePOSContext } from "../../utils/pos";

export default defineEventHandler(async (event) => {
  const context = await requirePOSContext(event);
  const query = getQuery(event);
  const branchId = typeof query.branchId === "string" && query.branchId.length > 0
    ? query.branchId
    : null;

  if (branchId) {
    assertBranchAccess(context, branchId);
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

  setCacheHeaders(event, { sMaxAge: 120, staleWhileRevalidate: 30, visibility: "private" });

  return {
    products: (products ?? []).map((product) => ({
      ...product,
      stock: branchId ? (stockByProductId[product.id] ?? 0) : null,
    })),
  };
});
