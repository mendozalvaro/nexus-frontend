import {
  requireAdminContext,
  type InternalRole,
} from "../../../utils/admin-users";

import type { Database } from "@/types/database.types";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "organization_id" | "full_name" | "email" | "role" | "is_active" | "created_at" | "last_login_at"
>;

type AssignmentRow = Pick<
  Database["public"]["Tables"]["employee_branch_assignments"]["Row"],
  "user_id" | "branch_id" | "is_primary"
>;

export default defineEventHandler(async (event) => {
  const context = await requireAdminContext(event);

  const { data: branches, error: branchesError } = await context.adminClient
    .from("branches")
    .select("id, name, code, is_active")
    .eq("organization_id", context.organizationId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (branchesError) {
    throw createError({
      statusCode: 500,
      statusMessage: branchesError.message,
    });
  }

  const branchOptions = (branches ?? []).map((branch) => ({
    label: `${branch.name} (${branch.code})`,
    value: branch.id,
  }));

  const branchLookup = new Map((branches ?? []).map((branch) => [branch.id, branch.name]));
  const branchIds = (branches ?? []).map((branch) => branch.id);

  const { data: profiles, error: profilesError } = await context.adminClient
    .from("profiles")
    .select("id, organization_id, full_name, email, role, is_active, created_at, last_login_at")
    .eq("organization_id", context.organizationId)
    .neq("role", "client")
    .order("full_name", { ascending: true });

  if (profilesError) {
    throw createError({
      statusCode: 500,
      statusMessage: profilesError.message,
    });
  }

  let assignments: AssignmentRow[] = [];
  if (branchIds.length > 0) {
    const { data, error } = await context.adminClient
      .from("employee_branch_assignments")
      .select("user_id, branch_id, is_primary")
      .in("branch_id", branchIds);

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message,
      });
    }

    assignments = data ?? [];
  }

  const assignmentsByUser = assignments.reduce<Map<string, Array<{ branchId: string; branchName: string; isPrimary: boolean }>>>(
    (accumulator, assignment) => {
      const row = accumulator.get(assignment.user_id) ?? [];
      row.push({
        branchId: assignment.branch_id,
        branchName: branchLookup.get(assignment.branch_id) ?? "Sucursal",
        isPrimary: assignment.is_primary ?? false,
      });
      accumulator.set(assignment.user_id, row);
      return accumulator;
    },
    new Map<string, Array<{ branchId: string; branchName: string; isPrimary: boolean }>>(),
  );

  const primaryBranchByUser = new Map<string, string | null>();
  for (const [userId, userAssignments] of assignmentsByUser.entries()) {
    const primaryAssignment = userAssignments.find((assignment) => assignment.isPrimary);
    primaryBranchByUser.set(userId, primaryAssignment?.branchId ?? userAssignments[0]?.branchId ?? null);
  }

  const users = (profiles ?? []).map((user: ProfileRow) => {
    const primaryBranchId = primaryBranchByUser.get(user.id) ?? null;

    return {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: (user.role ?? "employee") as InternalRole,
      branchId: primaryBranchId,
      branchName: primaryBranchId ? (branchLookup.get(primaryBranchId) ?? null) : null,
      isActive: user.is_active ?? true,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
      assignedBranches: assignmentsByUser.get(user.id) ?? [],
    };
  });

  return {
    organizationId: context.organizationId,
    users,
    branches: branchOptions,
  };
});
