import { assertCatalogEntityAccess, requireCatalogContext } from "../../utils/catalog";
import { getCatalogServices } from "../../services/catalog/services";

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  await assertCatalogEntityAccess(context, "service", "can_view");
  const services = await getCatalogServices(context);
  return services;
});
