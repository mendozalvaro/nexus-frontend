import {
  getInventoryCategories,
} from "../../services/inventory/categories";
import { setCacheHeaders } from "../../utils/cache";
import { requireInventoryContext } from "../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);

  const categories = await getInventoryCategories(context);

  setCacheHeaders(event, { sMaxAge: 120, staleWhileRevalidate: 60, visibility: "private" });

  return {
    categories,
  };
});