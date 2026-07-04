import { getInventoryOverview } from "../../services/inventory/overview";
import { setCacheHeaders } from "../../utils/cache";
import { requireInventoryContextStrict } from "../../utils/inventory-access";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContextStrict(event, "can_view");

  const overview = await getInventoryOverview(context);

  setCacheHeaders(event, { sMaxAge: 30, staleWhileRevalidate: 15, visibility: "private" });

  return overview;
});
