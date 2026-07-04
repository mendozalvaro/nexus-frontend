import { getQuery } from "h3";

import { getInventoryTransfersPage } from "../../../services/inventory/transfers-page";
import { requireInventoryContextStrict } from "../../../utils/inventory-access";

type TransferStatus = "pending" | "received" | "cancelled" | "all";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContextStrict(event, "can_view");

  const query = getQuery(event);
  const branchId = typeof query.branchId === "string" && query.branchId.length > 0 ? query.branchId : null;
  const productId = typeof query.productId === "string" && query.productId.length > 0 ? query.productId : null;
  const status = (typeof query.status === "string" ? query.status : "all") as TransferStatus;

  const data = await getInventoryTransfersPage(context, { branchId, productId, status }, false);

  return {
    success: true,
    rows: data.transfers,
    destinationBranches: data.destinationBranches,
    pendingInboundCount: data.pendingInboundCount,
  };
});
