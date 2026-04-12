import {
  assertCatalogUniqueSKU,
  catalogProductSchema,
  getCatalogCategoryOrThrow,
  getCatalogProductOrThrow,
  readValidatedCatalogBody,
  requireCatalogContext,
} from "../../../utils/catalog";

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  const productId = getRouterParam(event, "id");

  if (!productId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar el producto a actualizar.",
    });
  }

  const body = await readValidatedCatalogBody(event, catalogProductSchema);
  const product = await getCatalogProductOrThrow(context, productId);
  const normalizedSKU = body.sku.trim() || null;
  await assertCatalogUniqueSKU(context, normalizedSKU, product.id);

  if (body.categoryId) {
    await getCatalogCategoryOrThrow(context, body.categoryId, "product");
  }

  const { error } = await context.adminClient
    .from("products")
    .update({
      name: body.name.trim(),
      sku: normalizedSKU,
      description: body.description.trim() || null,
      image_url: body.imageUrl.trim() || null,
      cost_price: body.costPrice,
      sale_price: body.salePrice,
      category_id: body.categoryId,
      track_inventory: body.trackInventory,
    })
    .eq("id", product.id)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return { success: true, productId: product.id };
});
