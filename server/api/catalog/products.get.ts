import { requireTenantContext } from "../../utils/tenant-context";
import { getCatalogProducts } from "../../services/catalog/products";

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);
  const products = await getCatalogProducts(context);
  return products;
});