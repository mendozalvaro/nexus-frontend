import { getQuery } from "h3";

import { getInventoryHistoryPage } from "../../services/inventory/history-page";
import { setCacheHeaders } from "../../utils/cache";
import { requireInventoryContextStrict } from "../../utils/inventory-access";

type MovementType = "entry" | "exit" | "adjustment" | "transfer_in" | "transfer_out";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContextStrict(event, "can_view");

  const query = getQuery(event);
  const branchId = typeof query.branchId === "string" && query.branchId.length > 0 ? query.branchId : null;
  const productId = typeof query.productId === "string" && query.productId.length > 0 ? query.productId : null;
  const movementType = (typeof query.movementType === "string" ? query.movementType : "all") as MovementType | "all";
  const dateFrom = typeof query.dateFrom === "string" && query.dateFrom.length > 0 ? query.dateFrom : null;
  const dateTo = typeof query.dateTo === "string" && query.dateTo.length > 0 ? query.dateTo : null;

  const data = await getInventoryHistoryPage(context, {
    branchId,
    productId,
    movementType,
    dateFrom,
    dateTo,
  });

  setCacheHeaders(event, { sMaxAge: 30, staleWhileRevalidate: 15, visibility: "private" });

  return data;
});
