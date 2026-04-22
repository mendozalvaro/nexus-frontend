import type { Database } from "@/types/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];

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

    return await $fetch<UsersData>("/api/admin/users", {
      method: "GET",
      headers: await getAuthHeaders(),
    });
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

