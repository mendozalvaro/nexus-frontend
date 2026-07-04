import { getQuery } from "h3";
import { getSalesOrders } from "../../../services/pos/sales-orders";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const status = typeof query.status === "string" ? query.status : null;
  const branchId = typeof query.branchId === "string" ? query.branchId : null;
  return getSalesOrders(event, status, branchId);
});
