import {
  assertCatalogCategoryAccess,
  requireCatalogContext,
} from "../../utils/catalog";
import { getCatalogCategories } from "../../services/catalog/categories";

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  const query = getQuery(event);
  const categories = await getCatalogCategories(context);
  const type = query.type as string | undefined;
  if (type) {
    if (type === "product" || type === "service" || type === "lodging") {
      await assertCatalogCategoryAccess(context, type, "can_view");
    }
    return categories.filter((c) => c.type === type);
  }

  const allowedTypes: Array<"product" | "service" | "lodging"> = [];
  for (const categoryType of ["product", "service", "lodging"] as const) {
    try {
      await assertCatalogCategoryAccess(context, categoryType, "can_view");
      allowedTypes.push(categoryType);
    } catch {
      // ignore inaccessible types
    }
  }

  return categories.filter((category) => allowedTypes.includes(category.type));
});
