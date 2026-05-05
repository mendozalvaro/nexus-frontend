import { getInventoryProductsPage } from "../../services/inventory/products-page";
import { setCacheHeaders } from "../../utils/cache";
import { requireInventoryContext } from "../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);

  const data = await getInventoryProductsPage(context);

  setCacheHeaders(event, { sMaxAge: 60, staleWhileRevalidate: 30, visibility: "private" });

  return data;
});