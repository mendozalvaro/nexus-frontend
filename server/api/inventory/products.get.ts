import {
  getInventoryProducts,
} from "../../services/inventory/products";
import { setCacheHeaders } from "../../utils/cache";
import { requireInventoryContextStrict } from "../../utils/inventory-access";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContextStrict(event, "can_view");

  const products = await getInventoryProducts(context);

  setCacheHeaders(event, { sMaxAge: 60, staleWhileRevalidate: 30, visibility: "private" });

  return {
    products,
  };
});
