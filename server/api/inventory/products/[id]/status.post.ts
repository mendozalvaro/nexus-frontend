import {
  assertInventoryModuleAccess,
  getInventoryProductOrThrow,
  readValidatedInventoryBody,
  requireInventoryContext,
} from "../../../../utils/inventory";
import { z } from "zod";

const schema = z.object({
  isActive: z.boolean(),
});

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  await assertInventoryModuleAccess(context, "can_edit");
  const productId = getRouterParam(event, "id");

  if (!productId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar el producto a actualizar.",
    });
  }

  const { isActive } = await readValidatedInventoryBody(event, schema);
  const product = await getInventoryProductOrThrow(context, productId);

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

  return {
    success: true,
    productId: product.id,
    isActive,
  };
});
