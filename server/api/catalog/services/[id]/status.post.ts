import {
  catalogStatusSchema,
  getCatalogServiceOrThrow,
  readValidatedCatalogBody,
  requireCatalogContext,
} from "../../../../utils/catalog";

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  const serviceId = getRouterParam(event, "id");

  if (!serviceId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar el servicio a actualizar.",
    });
  }

  const { isActive } = await readValidatedCatalogBody(event, catalogStatusSchema);
  const service = await getCatalogServiceOrThrow(context, serviceId);

  const { error } = await context.adminClient
    .from("services")
    .update({ is_active: isActive })
    .eq("id", service.id)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return { success: true, serviceId: service.id, isActive };
});
