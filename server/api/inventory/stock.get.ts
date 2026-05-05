import { getQuery } from "h3";

import {
  getInventoryStock,
  getInventoryMovements,
} from "../../services/inventory/stock";
import { setCacheHeaders } from "../../utils/cache";
import { requireInventoryContext } from "../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  const query = getQuery(event);

  const branchId = typeof query.branchId === "string" ? query.branchId : null;
  const dateFrom = typeof query.dateFrom === "string" ? query.dateFrom : null;
  const dateTo = typeof query.dateTo === "string" ? query.dateTo : null;

  const accessibleBranchIds = context.role === "admin"
    ? null
    : context.allowedBranchIds;

  const [stock, movements] = await Promise.all([
    getInventoryStock(context, { branchIds: accessibleBranchIds }),
    getInventoryMovements(context, {
      branchIds: accessibleBranchIds ?? undefined,
      filters: {
        branchId,
        productId: null,
        movementType: "all",
        dateFrom,
        dateTo,
      },
      limit: 100,
    }),
  ]);

  setCacheHeaders(event, { sMaxAge: 60, staleWhileRevalidate: 30, visibility: "private" });

  return {
    stock,
    movements,
  };
});