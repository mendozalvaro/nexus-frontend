import { createError } from "h3";

import type { AdminContext, InternalRole } from "../../utils/admin-users";

export interface UserListItem {
  id: string;
  fullName: string;
  email: string;
  role: InternalRole;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
  assignedBranches: Array<{ branchId: string; branchName: string; isPrimary: boolean }>;
}

export interface BranchOption {
  label: string;
  value: string;
}

export const getUsersList = async (context: AdminContext) => {
  const { data: branches, error: branchesError } = await context.adminClient
    .from("branches")
    .select("id, name, code, is_active")
    .eq("organization_id", context.organizationId)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<Array<{ id: string; name: string; code: string | null; is_active: boolean }>>();

  if (branchesError) {
    throw createError({ statusCode: 500, statusMessage: branchesError.message });
  }

  const branchOptions: BranchOption[] = (branches ?? []).map((branch): BranchOption => ({
    label: `${branch.name} (${branch.code ?? ""})`,
    value: branch.id,
  }));

  const branchLookup = new Map((branches ?? []).map((b): [string, string | null] => [b.id, b.name]));
  const branchIds = (branches ?? []).map((b) => b.id);

  const { data: profiles, error: profilesError } = await context.adminClient
    .from("profiles")
    .select("id, organization_id, full_name, email, role, is_active, created_at, last_login_at")
    .eq("organization_id", context.organizationId)
    .neq("role", "client")
    .order("full_name", { ascending: true })
    .returns<Array<{ id: string; full_name: string; email: string; role: string; is_active: boolean | null; created_at: string | null; last_login_at: string | null }>>();

  if (profilesError) {
    throw createError({ statusCode: 500, statusMessage: profilesError.message });
  }

  let assignments: Array<{ user_id: string; branch_id: string; is_primary: boolean }> = [];
  if (branchIds.length > 0) {
    const { data, error } = await context.adminClient
      .from("employee_branch_assignments")
      .select("user_id, branch_id, is_primary")
      .in("branch_id", branchIds)
      .returns<Array<{ user_id: string; branch_id: string; is_primary: boolean | null }>>();

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message });
    }

    assignments = (data ?? []).map((a) => ({ ...a, is_primary: a.is_primary ?? false }));
  }

  const assignmentsByUser = new Map<string, Array<{ branchId: string; branchName: string; isPrimary: boolean }>>();
  for (const a of assignments) {
    const list = assignmentsByUser.get(a.user_id) ?? [];
    list.push({
      branchId: a.branch_id,
      branchName: branchLookup.get(a.branch_id) ?? "Sucursal",
      isPrimary: a.is_primary ?? false,
    });
    assignmentsByUser.set(a.user_id, list);
  }

  const primaryBranchByUser = new Map<string, string | null>();
  for (const [userId, userAssignments] of assignmentsByUser.entries()) {
    const primary = userAssignments.find((a) => a.isPrimary);
    primaryBranchByUser.set(userId, primary?.branchId ?? userAssignments[0]?.branchId ?? null);
  }

  const users: UserListItem[] = (profiles ?? []).map((user): UserListItem => {
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
    users,
    branches: branchOptions,
  };
};
