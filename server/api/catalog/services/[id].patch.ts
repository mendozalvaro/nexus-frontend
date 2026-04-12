import {
  assertCatalogUniqueServiceName,
  catalogServiceSchema,
  getCatalogCategoryOrThrow,
  getCatalogServiceOrThrow,
  readValidatedCatalogBody,
  requireCatalogContext,
} from "../../../utils/catalog";

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  const serviceId = getRouterParam(event, "id");

  if (!serviceId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar el servicio a actualizar.",
    });
  }

  const body = await readValidatedCatalogBody(event, catalogServiceSchema);
  const service = await getCatalogServiceOrThrow(context, serviceId);
  await assertCatalogUniqueServiceName(context, body.name.trim(), service.id);

  if (body.categoryId) {
    await getCatalogCategoryOrThrow(context, body.categoryId, "service");
  }

  const { error } = await context.adminClient
    .from("services")
    .update({
      name: body.name.trim(),
      description: body.description.trim() || null,
      image_url: body.imageUrl.trim() || null,
      price: body.price,
      duration_minutes: body.durationMinutes,
      category_id: body.categoryId,
    })
    .eq("id", service.id)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return { success: true, serviceId: service.id };
});
