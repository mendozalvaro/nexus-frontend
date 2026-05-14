import { getQuery } from "h3";

import { setCacheHeaders } from "../../utils/cache";
import { getPOSProducts } from "../../services/pos/products";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const branchId = typeof query.branchId === "string" && query.branchId.length > 0
    ? query.branchId
    : null;

  const result = await getPOSProducts(event, branchId);

  setCacheHeaders(event, { sMaxAge: 120, staleWhileRevalidate: 30, visibility: "private" });

  return result;
});
