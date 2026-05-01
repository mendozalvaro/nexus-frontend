import {
  assertInventoryModuleAccess,
  getProductCategoryOrThrow,
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
  const categoryId = getRouterParam(event, "id");

  if (!categoryId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar la categoría a actualizar.",
    });
  }

  const { isActive } = await readValidatedInventoryBody(event, schema);
  const category = await getProductCategoryOrThrow(context, categoryId);

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

  return {
    success: true,
    categoryId: category.id,
    isActive,
  };
});
