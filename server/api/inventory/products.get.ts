import {
  getInventoryProducts,
} from "../../services/inventory/products";
import { setCacheHeaders } from "../../utils/cache";
import { requireInventoryContext } from "../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);

  const products = await getInventoryProducts(context);

  setCacheHeaders(event, { sMaxAge: 60, staleWhileRevalidate: 30, visibility: "private" });

  return {
    products,
  };
});