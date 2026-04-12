import {
  assertCatalogUniqueCategoryName,
  catalogCategorySchema,
  getCatalogCategoryOrThrow,
  readValidatedCatalogBody,
  requireCatalogContext,
} from "../../../utils/catalog";

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  const categoryId = getRouterParam(event, "id");

  if (!categoryId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar la categoria a actualizar.",
    });
  }

  const body = await readValidatedCatalogBody(event, catalogCategorySchema);
  const category = await getCatalogCategoryOrThrow(context, categoryId);
  await assertCatalogUniqueCategoryName(context, body.name.trim(), body.type, category.id);

  if (body.parentId) {
    if (body.parentId === category.id) {
      throw createError({
        statusCode: 409,
        statusMessage: "Una categoria no puede ser padre de si misma.",
      });
    }

    await getCatalogCategoryOrThrow(context, body.parentId, body.type);
  }

  const { error } = await context.adminClient
    .from("categories")
    .update({
      name: body.name.trim(),
      parent_id: body.parentId,
      type: body.type,
    })
    .eq("id", category.id)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return { success: true, categoryId: category.id };
});
