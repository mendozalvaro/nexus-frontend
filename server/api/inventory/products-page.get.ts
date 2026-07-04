import { getInventoryProductsPage } from "../../services/inventory/products-page";
import { setCacheHeaders } from "../../utils/cache";
import { requireInventoryContextStrict } from "../../utils/inventory-access";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContextStrict(event, "can_view");

  const data = await getInventoryProductsPage(context);

  setCacheHeaders(event, { sMaxAge: 60, staleWhileRevalidate: 30, visibility: "private" });

  return data;
});
