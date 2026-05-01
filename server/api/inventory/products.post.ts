import {
  assertInventoryModuleAccess,
  assertUniqueSKU,
  getProductCategoryOrThrow,
  productSchema,
  readValidatedInventoryBody,
  requireInventoryContext,
} from "../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  await assertInventoryModuleAccess(context, "can_create");
  const body = await readValidatedInventoryBody(event, productSchema);

  const normalizedSKU = body.sku.trim() || null;

  await assertUniqueSKU(context, normalizedSKU);

  if (body.categoryId) {
    await getProductCategoryOrThrow(context, body.categoryId);
  }

  const { data, error } = await context.adminClient
    .from("products")
    .insert({
      organization_id: context.organizationId,
      name: body.name.trim(),
      sku: normalizedSKU,
      description: body.description.trim() || null,
      cost_price: body.costPrice,
      sale_price: body.salePrice,
      category_id: body.categoryId,
      track_inventory: body.trackInventory,
      is_active: true,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? "No se pudo crear el producto.",
    });
  }

  return {
    success: true,
    productId: data.id,
  };
});
