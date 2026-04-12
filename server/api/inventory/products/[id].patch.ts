import {
  assertUniqueSKU,
  getInventoryProductOrThrow,
  getProductCategoryOrThrow,
  productSchema,
  readValidatedInventoryBody,
  requireInventoryContext,
} from "../../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  const productId = getRouterParam(event, "id");

  if (!productId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar el producto a actualizar.",
    });
  }

  const body = await readValidatedInventoryBody(event, productSchema);
  const currentProduct = await getInventoryProductOrThrow(context, productId);
  const normalizedSKU = body.sku.trim() || null;

  await assertUniqueSKU(context, normalizedSKU, currentProduct.id);

  if (body.categoryId) {
    await getProductCategoryOrThrow(context, body.categoryId);
  }

  const { error } = await context.adminClient
    .from("products")
    .update({
      name: body.name.trim(),
      sku: normalizedSKU,
      description: body.description.trim() || null,
      cost_price: body.costPrice,
      sale_price: body.salePrice,
      category_id: body.categoryId,
      track_inventory: body.trackInventory,
    })
    .eq("id", currentProduct.id)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return {
    success: true,
    productId: currentProduct.id,
  };
});
