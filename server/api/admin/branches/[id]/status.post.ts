import {
  branchStatusSchema,
  ensureAtLeastOneActiveBranch,
  getAdminBranchOrThrow,
  readValidatedBranchBody,
  requireBranchAdminContext,
} from "../../../../utils/admin-branches";

export default defineEventHandler(async (event) => {
  const context = await requireBranchAdminContext(event);
  const branchId = getRouterParam(event, "id");

  if (!branchId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar la sucursal a actualizar.",
    });
  }

  const body = await readValidatedBranchBody(event, branchStatusSchema);
  const branch = await getAdminBranchOrThrow(context.adminClient, context.organizationId, branchId);

  if ((branch.is_active ?? true) === body.isActive) {
    return {
      success: true,
      branchId,
    };
  }

  await ensureAtLeastOneActiveBranch(
    context.adminClient,
    context.organizationId,
    branchId,
    body.isActive,
  );

  const { error } = await context.adminClient
    .from("branches")
    .update({ is_active: body.isActive })
    .eq("organization_id", context.organizationId)
    .eq("id", branchId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return {
    success: true,
    branchId,
    isActive: body.isActive,
  };
});
