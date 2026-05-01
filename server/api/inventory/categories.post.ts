import {
  assertInventoryModuleAccess,
  assertUniqueProductCategoryName,
  categorySchema,
  getProductCategoryOrThrow,
  readValidatedInventoryBody,
  requireInventoryContext,
} from "../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  await assertInventoryModuleAccess(context, "can_create");
  const body = await readValidatedInventoryBody(event, categorySchema);

  await assertUniqueProductCategoryName(context, body.name.trim());

  if (body.parentId) {
    await getProductCategoryOrThrow(context, body.parentId);
  }

  const { data, error } = await context.adminClient
    .from("categories")
    .insert({
      organization_id: context.organizationId,
      name: body.name.trim(),
      parent_id: body.parentId,
      type: "product",
      is_active: true,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? "No se pudo crear la categoría.",
    });
  }

  return {
    success: true,
    categoryId: data.id,
  };
});
