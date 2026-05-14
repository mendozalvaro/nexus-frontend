import { getQuery } from "h3";

import { searchPOSCustomers } from "../../services/pos/customers";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const search = typeof query.q === "string" ? query.q.trim() : "";

  return searchPOSCustomers(event, search);
});
