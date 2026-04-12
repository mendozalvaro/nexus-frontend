import {
  assertUniqueBranchCode,
  getAdminBranchOrThrow,
  readValidatedBranchBody,
  requireBranchAdminContext,
  sanitizeBranchPayload,
  updateBranchSchema,
} from "../../../utils/admin-branches";

export default defineEventHandler(async (event) => {
  const context = await requireBranchAdminContext(event);
  const branchId = getRouterParam(event, "id");

  if (!branchId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar la sucursal a actualizar.",
    });
  }

  const body = await readValidatedBranchBody(event, updateBranchSchema);
  const payload = sanitizeBranchPayload(body);
  const existingBranch = await getAdminBranchOrThrow(context.adminClient, context.organizationId, branchId);

  if (existingBranch.code !== payload.code) {
    await assertUniqueBranchCode(context.adminClient, context.organizationId, payload.code, branchId);
  }

  const { error } = await context.adminClient
    .from("branches")
    .update({
      name: payload.name,
      code: payload.code,
      address: payload.address,
      phone: payload.phone,
      settings: payload.settings,
    })
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
  };
});
