import {
  assertBranchCreationAllowed,
  assertUniqueBranchCode,
  createBranchSchema,
  readValidatedBranchBody,
  requireBranchAdminContext,
  sanitizeBranchPayload,
} from "../../utils/admin-branches";

export default defineEventHandler(async (event) => {
  const context = await requireBranchAdminContext(event);
  const body = await readValidatedBranchBody(event, createBranchSchema);
  const payload = sanitizeBranchPayload(body);

  assertBranchCreationAllowed(context);
  await assertUniqueBranchCode(context.adminClient, context.organizationId, payload.code);

  const { data, error } = await context.adminClient
    .from("branches")
    .insert({
      organization_id: context.organizationId,
      name: payload.name,
      code: payload.code,
      address: payload.address,
      phone: payload.phone,
      settings: payload.settings,
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? "No se pudo crear la sucursal.",
    });
  }

  return {
    success: true,
    branchId: data.id,
  };
});
