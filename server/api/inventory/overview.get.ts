import { getInventoryOverview } from "../../services/inventory/overview";
import { setCacheHeaders } from "../../utils/cache";
import { requireInventoryContext } from "../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);

  const overview = await getInventoryOverview(context);

  setCacheHeaders(event, { sMaxAge: 30, staleWhileRevalidate: 15, visibility: "private" });

  return overview;
});