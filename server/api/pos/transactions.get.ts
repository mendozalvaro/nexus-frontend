import { getQuery } from "h3";

import { getPOSTransactions } from "../../services/pos/transactions";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const date = typeof query.date === "string" && query.date.trim().length > 0
    ? query.date
    : new Date().toISOString().slice(0, 10);
  const branchId = typeof query.branchId === "string" && query.branchId.trim().length > 0
    ? query.branchId
    : null;

  return getPOSTransactions(event, date, branchId);
});
