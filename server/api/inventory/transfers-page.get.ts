import { getQuery } from "h3";

import { getInventoryTransfersPage } from "../../services/inventory/transfers-page";
import { setCacheHeaders } from "../../utils/cache";
import { requireInventoryContext } from "../../utils/inventory";

type TransferStatus = "pending" | "received" | "cancelled" | "all";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);

  const query = getQuery(event);
  const branchId = typeof query.branchId === "string" && query.branchId.length > 0 ? query.branchId : null;
  const productId = typeof query.productId === "string" && query.productId.length > 0 ? query.productId : null;
  const status = (typeof query.status === "string" ? query.status : "all") as TransferStatus | "all";
  const includeProducts = query.includeProducts !== "false";

  const data = await getInventoryTransfersPage(
    context,
    { branchId, productId, status },
    includeProducts,
  );

  setCacheHeaders(event, { sMaxAge: 30, staleWhileRevalidate: 15, visibility: "private" });

  return data;
});