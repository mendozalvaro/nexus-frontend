import {
  getInventoryCategories,
} from "../../services/inventory/categories";
import { setCacheHeaders } from "../../utils/cache";
import { requireInventoryContextStrict } from "../../utils/inventory-access";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContextStrict(event, "can_view");

  const categories = await getInventoryCategories(context);

  setCacheHeaders(event, { sMaxAge: 120, staleWhileRevalidate: 60, visibility: "private" });

  return {
    categories,
  };
});
