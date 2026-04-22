import type { Database } from "@/types/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];

export interface UserBranchAssignment {
  branchId: string;
  branchName: string;
  isPrimary: boolean;
}

export interface UserBranchOption {
  label: string;
  value: string;
}

export interface UserListRow {
  id: string;
  fullName: string;
  email: string;
  role: Exclude<UserRole, "client">;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
  assignedBranches: UserBranchAssignment[];
}

export interface UsersData {
  organizationId: string;
  users: UserListRow[];
  branches: UserBranchOption[];
}

export interface UserMutationPayload {
  fullName: string;
  email: string;
  role: Exclude<UserRole, "client">;
  branchId: string | null;
  assignedBranchIds: string[];
  primaryBranchId: string | null;
  password?: string;
}

export interface UsersFilters {
  search: string;
  role: "all" | Exclude<UserRole, "client">;
  branchId: string | null;
  status: "all" | "active" | "inactive";
}

export const useUsers = () => {
  const supabase = useSupabaseClient<Database>();
  const { resolveAccessToken } = useSessionAccess();
  const { profile, fetchProfile } = useAuth();
  const {
    capabilities,
    loadCapabilities,
    getUpgradeMessage,
    canCreateResource,
    getPlanNumericLimit,
  } = useSubscription();

  const roleOptions: Array<{ label: string; value: UsersFilters["role"] }> = [
    { label: "Todos los roles", value: "all" },
    { label: "Admin", value: "admin" },
    { label: "Manager", value: "manager" },
    { label: "Employee", value: "employee" },
  ];

  const statusOptions: Array<{ label: string; value: UsersFilters["status"] }> = [
    { label: "Todos", value: "all" },
    { label: "Activos", value: "active" },
    { label: "Inactivos", value: "inactive" },
  ];

  const getDefaultFilters = (): UsersFilters => ({
    search: "",
    role: "all",
    branchId: null,
    status: "all",
  });

  const getAuthHeaders = async () => {
    const token = await resolveAccessToken();
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: "La sesión no está disponible para gestionar usuarios.",
      });
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const loadUsers = async (): Promise<UsersData> => {
    const currentProfile = profile.value ?? (await fetchProfile());
    const canManageUsers = currentProfile?.role === "admin" || currentProfile?.role === "manager";
    if (!currentProfile?.organization_id || !canManageUsers) {
      throw createError({
        statusCode: 403,
        statusMessage: "Solo usuarios admin o manager pueden acceder al modulo de usuarios.",
      });
    }

    await loadCapabilities(currentProfile.organization_id);

    const { data: branches, error: branchesError } = await supabase
      .from("branches")
      .select("id, name, code, organization_id, is_active")
      .eq("organization_id", currentProfile.organization_id)
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

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, organization_id, full_name, email, role, is_active, created_at, last_login_at")
      .eq("organization_id", currentProfile.organization_id)
      .neq("role", "client")
      .order("full_name", { ascending: true });

    if (profilesError) {
      throw createError({
        statusCode: 500,
        statusMessage: profilesError.message,
      });
    }

    const branchIds = (branches ?? []).map((branch) => branch.id);
    let assignments: AssignmentRow[] = [];

    if (branchIds.length > 0) {
      const { data, error } = await supabase
        .from("employee_branch_assignments")
        .select("id, user_id, branch_id, is_primary, can_manage_inventory, can_override_prices, skills")
        .in("branch_id", branchIds);

      if (error) {
        throw createError({
          statusCode: 500,
          statusMessage: error.message,
        });
      }

      assignments = data ?? [];
    }

    const assignmentsByUser = assignments.reduce<Map<string, UserBranchAssignment[]>>((accumulator, assignment) => {
      const row = accumulator.get(assignment.user_id) ?? [];
      row.push({
        branchId: assignment.branch_id,
        branchName: branchLookup.get(assignment.branch_id) ?? "Sucursal",
        isPrimary: assignment.is_primary ?? false,
      });
      accumulator.set(assignment.user_id, row);
      return accumulator;
    }, new Map<string, UserBranchAssignment[]>());

    const primaryBranchByUser = new Map<string, string | null>();
    for (const [userId, userAssignments] of assignmentsByUser.entries()) {
      const primaryAssignment = userAssignments.find((assignment) => assignment.isPrimary);
      primaryBranchByUser.set(userId, primaryAssignment?.branchId ?? userAssignments[0]?.branchId ?? null);
    }

    const users = (profiles ?? []).map((user) => {
      const primaryBranchId = primaryBranchByUser.get(user.id) ?? null;
      return {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: (user.role ?? "employee") as Exclude<UserRole, "client">,
        branchId: primaryBranchId,
        branchName: primaryBranchId ? (branchLookup.get(primaryBranchId) ?? null) : null,
        isActive: user.is_active ?? true,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
        assignedBranches: assignmentsByUser.get(user.id) ?? [],
      };
    });

    return {
      organizationId: currentProfile.organization_id,
      users,
      branches: branchOptions,
    };
  };

  const createUser = async (payload: UserMutationPayload) => {
    return await $fetch("/api/admin/users", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: payload,
    });
  };

  const updateUser = async (userId: string, payload: UserMutationPayload) => {
    return await $fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: payload,
    });
  };

  const deactivateUser = async (userId: string) => {
    return await $fetch(`/api/admin/users/${userId}/deactivate`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  };

  const userLimitMessage = computed(() => {
    return getUpgradeMessage("user");
  });

  const canCreateMoreUsers = computed(() => {
    if (!capabilities.value) {
      return false;
    }

    return canCreateResource("user");
  });

  const isOverUserLimit = computed(() => {
    if (!capabilities.value) {
      return false;
    }

    const usersLimit = getPlanNumericLimit(["users", "users.max", "seats", "seats.total"])
      ?? capabilities.value.maxUsers;
    return capabilities.value.currentUsersCount > usersLimit;
  });

  return {
    capabilities,
    roleOptions,
    statusOptions,
    getDefaultFilters,
    loadUsers,
    createUser,
    updateUser,
    deactivateUser,
    userLimitMessage,
    canCreateMoreUsers,
    isOverUserLimit,
  };
};

