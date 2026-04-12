import {
  catalogStatusSchema,
  getCatalogProductOrThrow,
  readValidatedCatalogBody,
  requireCatalogContext,
} from "../../../../utils/catalog";

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  const productId = getRouterParam(event, "id");

  if (!productId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar el producto a actualizar.",
    });
  }

  const { isActive } = await readValidatedCatalogBody(event, catalogStatusSchema);
  const product = await getCatalogProductOrThrow(context, productId);

  const { error } = await context.adminClient
    .from("products")
    .update({ is_active: isActive })
    .eq("id", product.id)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return { success: true, productId: product.id, isActive };
});
