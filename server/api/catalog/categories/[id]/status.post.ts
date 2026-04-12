import {
  catalogStatusSchema,
  getCatalogCategoryOrThrow,
  readValidatedCatalogBody,
  requireCatalogContext,
} from "../../../../utils/catalog";

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  const categoryId = getRouterParam(event, "id");

  if (!categoryId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar la categoria a actualizar.",
    });
  }

  const { isActive } = await readValidatedCatalogBody(event, catalogStatusSchema);
  const category = await getCatalogCategoryOrThrow(context, categoryId);

  const { error } = await context.adminClient
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", category.id)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return { success: true, categoryId: category.id, isActive };
});
