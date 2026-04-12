import { getRouterParam } from "h3";

import { requireAdminContext } from "../../../../utils/admin-users";

export default defineEventHandler(async (event) => {
  const context = await requireAdminContext(event);
  const userId = getRouterParam(event, "id");

  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "No se recibió el usuario a desactivar.",
    });
  }

  if (userId === context.userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "No puedes desactivar tu propia cuenta de administrador.",
    });
  }

  const { error } = await context.adminClient
    .from("profiles")
    .update({ is_active: false })
    .eq("id", userId)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return { success: true };
});
