import { requireTenantContext } from "../../utils/tenant-context";
import { getCatalogCategories } from "../../services/catalog/categories";

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);
  const categories = await getCatalogCategories(context);
  return categories;
});