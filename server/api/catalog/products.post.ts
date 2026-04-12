import {
  assertCatalogUniqueSKU,
  catalogProductSchema,
  getCatalogCategoryOrThrow,
  readValidatedCatalogBody,
  requireCatalogContext,
} from "../../utils/catalog";

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  const body = await readValidatedCatalogBody(event, catalogProductSchema);
  const normalizedSKU = body.sku.trim() || null;

  await assertCatalogUniqueSKU(context, normalizedSKU);

  if (body.categoryId) {
    await getCatalogCategoryOrThrow(context, body.categoryId, "product");
  }

  const { data, error } = await context.adminClient
    .from("products")
    .insert({
      organization_id: context.organizationId,
      name: body.name.trim(),
      sku: normalizedSKU,
      description: body.description.trim() || null,
      image_url: body.imageUrl.trim() || null,
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

  return { success: true, productId: data.id };
});
