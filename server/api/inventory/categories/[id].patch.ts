import {
  assertInventoryModuleAccess,
  assertUniqueProductCategoryName,
  categorySchema,
  getProductCategoryOrThrow,
  readValidatedInventoryBody,
  requireInventoryContext,
} from "../../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  await assertInventoryModuleAccess(context, "can_edit");
  const categoryId = getRouterParam(event, "id");

  if (!categoryId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar la categoría a actualizar.",
    });
  }

  const body = await readValidatedInventoryBody(event, categorySchema);
  const category = await getProductCategoryOrThrow(context, categoryId);

  await assertUniqueProductCategoryName(context, body.name.trim(), category.id);

  if (body.parentId) {
    if (body.parentId === category.id) {
      throw createError({
        statusCode: 409,
        statusMessage: "Una categoría no puede ser padre de sí misma.",
      });
    }

    await getProductCategoryOrThrow(context, body.parentId);
  }

  const { error } = await context.adminClient
    .from("categories")
    .update({
      name: body.name.trim(),
      parent_id: body.parentId,
    })
    .eq("id", category.id)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return {
    success: true,
    categoryId: category.id,
  };
});
