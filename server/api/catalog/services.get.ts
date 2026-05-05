import { requireTenantContext } from "../../utils/tenant-context";
import { getCatalogServices } from "../../services/catalog/services";

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);
  const services = await getCatalogServices(context);
  return services;
});