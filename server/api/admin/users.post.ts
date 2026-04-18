import {
  assertBranchesBelongToOrganization,
  assertPlanPermission,
  assertRoleRules,
  assertUserLimit,
  buildUserMetadata,
  createUserSchema,
  readValidatedAdminBody,
  requireAdminContext,
  sanitizeEmail,
  syncEmployeeAssignments,
} from "../../utils/admin-users";

export default defineEventHandler(async (event) => {
  const context = await requireAdminContext(event);
  const body = await readValidatedAdminBody(event, createUserSchema);

  await assertPlanPermission(context, "users");

  const email = sanitizeEmail(body.email);
  const assignedBranchIds = Array.from(new Set(body.assignedBranchIds));
  const branchIdsToValidate = body.branchId ? [body.branchId, ...assignedBranchIds] : assignedBranchIds;

  assertRoleRules(
    context,
    body.role,
    body.branchId,
    assignedBranchIds,
    body.primaryBranchId,
    context.capabilities.canCreateManager,
  );
  await assertUserLimit(context, body.role);
  await assertBranchesBelongToOrganization(context.adminClient, context.organizationId, branchIdsToValidate);

  const { data: existingProfile } = await context.adminClient
    .from("profiles")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    throw createError({
      statusCode: 409,
      statusMessage: "Ya existe un usuario con ese email dentro de la organización.",
    });
  }

  const { data: authUserData, error: authUserError } = await context.adminClient.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
    user_metadata: buildUserMetadata({
      fullName: body.fullName,
      organizationId: context.organizationId,
      role: body.role,
      branchId: body.branchId,
    }),
  });

  if (authUserError || !authUserData.user) {
    throw createError({
      statusCode: 500,
      statusMessage: authUserError?.message ?? "No se pudo crear el usuario en Auth.",
    });
  }

  try {
    const { error: profileError } = await context.adminClient.from("profiles").insert({
      id: authUserData.user.id,
      organization_id: context.organizationId,
      branch_id: body.branchId,
      full_name: body.fullName,
      email,
      role: body.role,
      is_active: true,
    });

    if (profileError) {
      throw profileError;
    }

    await syncEmployeeAssignments(
      context.adminClient,
      authUserData.user.id,
      body.role,
      body.branchId,
      assignedBranchIds,
      body.primaryBranchId,
    );

    return {
      success: true,
      userId: authUserData.user.id,
    };
  } catch (error) {
    await context.adminClient.auth.admin.deleteUser(authUserData.user.id);

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "No se pudo completar la creación del usuario.",
    });
  }
});
