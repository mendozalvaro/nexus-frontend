import { createError, getQuery } from "h3";

import { setCacheHeaders } from "../../utils/cache";
import { requireTenantContext } from "../../utils/tenant-context";

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);
  const query = getQuery(event);
  const branchId = typeof query.branchId === "string" && query.branchId.length > 0
    ? query.branchId
    : null;

  const accessibleBranchIds = context.role === "admin"
    ? null
    : await (async () => {
      const { data, error } = await context.adminClient
        .from("employee_branch_assignments")
        .select("branch_id")
        .eq("user_id", context.userId);

      if (error) {
        throw createError({ statusCode: 500, statusMessage: error.message });
      }

      return Array.from(new Set((data ?? []).map((row: { branch_id: string }) => row.branch_id)));
    })();

  if (branchId && accessibleBranchIds && !accessibleBranchIds.includes(branchId)) {
    throw createError({ statusCode: 403, statusMessage: "No tienes acceso a esa sucursal." });
  }

  let stockQuery = context.adminClient
    .from("inventory_stock")
    .select("id, branch_id, product_id, quantity, reserved_quantity, min_stock_level, updated_at")
    .order("updated_at", { ascending: false });

  if (branchId) {
    stockQuery = stockQuery.eq("branch_id", branchId);
  } else if (accessibleBranchIds && accessibleBranchIds.length > 0) {
    stockQuery = stockQuery.in("branch_id", accessibleBranchIds);
  } else if (accessibleBranchIds) {
    return { stock: [] };
  }

  const { data, error } = await stockQuery;
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  setCacheHeaders(event, { sMaxAge: 90, staleWhileRevalidate: 30, visibility: "private" });
  return { stock: data ?? [] };
});
