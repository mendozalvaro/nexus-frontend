import {
  assertCatalogUniqueServiceName,
  catalogServiceSchema,
  getCatalogCategoryOrThrow,
  readValidatedCatalogBody,
  requireCatalogContext,
} from "../../utils/catalog";

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  const body = await readValidatedCatalogBody(event, catalogServiceSchema);

  await assertCatalogUniqueServiceName(context, body.name.trim());

  if (body.categoryId) {
    await getCatalogCategoryOrThrow(context, body.categoryId, "service");
  }

  const { data, error } = await context.adminClient
    .from("services")
    .insert({
      organization_id: context.organizationId,
      name: body.name.trim(),
      description: body.description.trim() || null,
      image_url: body.imageUrl.trim() || null,
      price: body.price,
      duration_minutes: body.durationMinutes,
      category_id: body.categoryId,
      is_active: true,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? "No se pudo crear el servicio.",
    });
  }

  return { success: true, serviceId: data.id };
});
