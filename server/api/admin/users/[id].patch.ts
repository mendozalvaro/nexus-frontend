import { getRouterParam } from "h3";

import {
  assertBranchesBelongToOrganization,
  assertPlanPermission,
  assertRoleRules,
  assertUserLimit,
  buildUserMetadata,
  readValidatedAdminBody,
  requireAdminContext,
  sanitizeEmail,
  syncEmployeeAssignments,
  updateUserSchema,
} from "../../../utils/admin-users";

export default defineEventHandler(async (event) => {
  const context = await requireAdminContext(event);
  const userId = getRouterParam(event, "id");
  const body = await readValidatedAdminBody(event, updateUserSchema);

  await assertPlanPermission(context, "users");

  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "No se recibió el identificador del usuario a actualizar.",
    });
  }

  const { data: existingProfile, error: existingProfileError } = await context.adminClient
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", userId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (existingProfileError || !existingProfile) {
    throw createError({
      statusCode: 404,
      statusMessage: "No se encontró el usuario dentro de tu organización.",
    });
  }

  if (context.actorRole === "manager" && existingProfile.role !== "employee") {
    throw createError({
      statusCode: 403,
      statusMessage: "Un manager solo puede editar usuarios con rol employee.",
    });
  }

  if (existingProfile.role === "admin" || body.role === "admin") {
    throw createError({
      statusCode: 403,
      statusMessage: "Solo system puede modificar asignaciones del rol admin.",
    });
  }

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
    existingProfile.role,
  );
  await assertUserLimit(context, body.role, existingProfile.role);
  await assertBranchesBelongToOrganization(context.adminClient, context.organizationId, branchIdsToValidate);

  const { data: duplicateProfile } = await context.adminClient
    .from("profiles")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("email", email)
    .neq("id", userId)
    .maybeSingle();

  if (duplicateProfile) {
    throw createError({
      statusCode: 409,
      statusMessage: "Otro usuario de la organización ya usa ese email.",
    });
  }

  const { error: authUpdateError } = await context.adminClient.auth.admin.updateUserById(userId, {
    email,
    password: body.password,
    user_metadata: buildUserMetadata({
      fullName: body.fullName,
      organizationId: context.organizationId,
      role: body.role,
    }),
  });

  if (authUpdateError) {
    throw createError({
      statusCode: 500,
      statusMessage: authUpdateError.message,
    });
  }

  const { error: profileError } = await context.adminClient
    .from("profiles")
    .update({
      full_name: body.fullName,
      email,
      role: body.role,
    })
    .eq("id", userId)
    .eq("organization_id", context.organizationId);

  if (profileError) {
    throw createError({
      statusCode: 500,
      statusMessage: profileError.message,
    });
  }

  await syncEmployeeAssignments(
    context.adminClient,
    userId,
    body.role,
    body.branchId,
    assignedBranchIds,
    body.primaryBranchId,
  );

  return { success: true };
});
