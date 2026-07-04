import { createError } from "h3";

import type { AdminContext, InternalRole } from "../../utils/admin-users";

import {
  assertBranchesBelongToOrganization,
  assertManagerBranchScope,
  assertPlanPermission,
  assertRoleRules,
  assertUserLimit,
  buildUserMetadata,
  syncEmployeeAssignments,
} from "../../utils/admin-users";

interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
  role: InternalRole;
  branchId: string | null;
  assignedBranchIds: string[];
  primaryBranchId: string | null;
}

export const createManagedUser = async (context: AdminContext, input: CreateUserInput) => {
  const assignedBranchIds = Array.from(new Set(input.assignedBranchIds));
  const branchIdsToValidate = input.branchId ? [input.branchId, ...assignedBranchIds] : assignedBranchIds;

  assertRoleRules(
    context,
    input.role,
    input.branchId,
    assignedBranchIds,
    input.primaryBranchId,
    context.capabilities.canCreateManager,
  );
  await assertPlanPermission(context, "users");
  await assertUserLimit(context, input.role);
  await assertBranchesBelongToOrganization(context.adminClient, context.organizationId, branchIdsToValidate);
  assertManagerBranchScope(context, branchIdsToValidate);

  const { data: existingProfile } = await context.adminClient
    .from("profiles")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("email", input.email)
    .maybeSingle();

  if (existingProfile) {
    throw createError({
      statusCode: 409,
      statusMessage: "Ya existe un usuario con ese email dentro de la organizacion.",
    });
  }

  const { data: authUserData, error: authUserError } = await context.adminClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: buildUserMetadata({
      fullName: input.fullName,
      organizationId: context.organizationId,
      role: input.role,
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
      full_name: input.fullName,
      email: input.email,
      role: input.role,
      is_active: true,
    });

    if (profileError) {
      throw profileError;
    }

    await syncEmployeeAssignments(
      context.adminClient,
      authUserData.user.id,
      input.role,
      input.branchId,
      assignedBranchIds,
      input.primaryBranchId,
    );

    return {
      success: true,
      userId: authUserData.user.id,
    };
  } catch (error) {
    await context.adminClient.auth.admin.deleteUser(authUserData.user.id);

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "No se pudo completar la creacion del usuario.",
    });
  }
};
