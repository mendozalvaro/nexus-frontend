import { assertCatalogEntityAccess, requireCatalogContext } from "../../utils/catalog";
import { getCatalogProducts } from "../../services/catalog/products";

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  await assertCatalogEntityAccess(context, "product", "can_view");
  const products = await getCatalogProducts(context);
  return products;
});
