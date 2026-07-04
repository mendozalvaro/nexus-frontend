import {
  assertCatalogCategoryAccess,
  assertCatalogUniqueCategoryName,
  catalogCategorySchema,
  getCatalogCategoryOrThrow,
  readValidatedCatalogBody,
  requireCatalogContext,
} from "../../utils/catalog";

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  const body = await readValidatedCatalogBody(event, catalogCategorySchema);
  await assertCatalogCategoryAccess(context, body.type, "can_create");

  await assertCatalogUniqueCategoryName(context, body.name.trim(), body.type);

  if (body.parentId) {
    await getCatalogCategoryOrThrow(context, body.parentId, body.type);
  }

  const { data, error } = await context.adminClient
    .from("categories")
    .insert({
      organization_id: context.organizationId,
      name: body.name.trim(),
      parent_id: body.parentId,
      type: body.type,
      description: body.description?.trim() || null,
      is_active: true,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? "No se pudo crear la categoria.",
    });
  }

  return { success: true, categoryId: data.id };
});
