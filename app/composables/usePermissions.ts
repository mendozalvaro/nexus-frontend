import type { Database } from "@/types/database.types";
import type {
  AccessibleBranch,
  Permission,
  PermissionGrant,
  RouteAccessResolution,
  RoutePermissionMeta,
  UserRole,
} from "@/types/permissions";
import { ROLE_PERMISSIONS } from "@/types/permissions";
import { resolvePlanPermission } from "@/utils/subscription-plan";

const PERMISSIONS_CACHE_TTL_MS = 30_000;
const accessibleBranchesInFlight = new Map<string, Promise<AccessibleBranch[]>>();

export const usePermissions = () => {
  const supabase = useSupabaseClient<Database>();
  const { user, profile, permissionsRevision, setPermissionGrants } = useUserContext();
  const { resolveAccessToken } = useSessionAccess();
  const { isFeatureEnabled } = useFeatureFlags();
  const { capabilities } = useSubscription();
  const dbPermissionGrants = useState<PermissionGrant[]>("permissions:db-grants", () => []);
  const dbPermissionRoleId = useState<string | null>("permissions:db-role-id", () => null);
  const dbPermissionLoading = useState<boolean>("permissions:db-loading", () => false);
  const dbPermissionFetchedAt = useState<number>("permissions:db-fetched-at", () => 0);
  const accessibleBranchesCache = useState<{
    key: string | null;
    branches: AccessibleBranch[];
    fetchedAt: number;
  }>("permissions:accessible-branches-cache", () => ({
    key: null,
    branches: [],
    fetchedAt: 0,
  }));

  const removePermission = (
    permissions: PermissionGrant[],
    permissionToRemove: Permission,
  ): PermissionGrant[] => {
    return permissions.filter((permission) => {
      if (permission.endsWith(".*")) {
        return !permissionToRemove.startsWith(permission.slice(0, -1));
      }

      return permission !== permissionToRemove;
    });
  };

  const resolvePermissionModule = (permission: PermissionGrant): string => {
    const [module] = permission.split(".");
    return module ?? "";
  };

  const MODULE_ACTION_PERMISSION_MAP: Record<string, Partial<Record<
    | "can_view"
    | "can_create"
    | "can_edit"
    | "can_delete"
    | "can_export"
    | "can_manage",
    PermissionGrant
  >>> = {
    pos: {
      can_view: "pos.view",
      can_create: "pos.create",
      can_edit: "pos.edit",
      can_delete: "pos.delete",
      can_manage: "pos.*",
    },
    catalog: {
      can_view: "catalog.view",
      can_edit: "catalog.edit",
      can_manage: "catalog.*",
    },
    inventory: {
      can_view: "inventory.view",
      can_edit: "inventory.adjust",
      can_delete: "inventory.delete",
      can_manage: "inventory.*",
    },
    service_assignment: {
      can_view: "service_assignment.view",
      can_edit: "service_assignment.edit",
      can_manage: "service_assignment.*",
    },
    appointments: {
      can_view: "appointments.view",
      can_create: "appointments.create",
      can_edit: "appointments.edit",
      can_delete: "appointments.delete",
      can_manage: "appointments.*",
    },
    users: {
      can_view: "users.view",
      can_create: "users.create",
      can_edit: "users.edit",
      can_delete: "users.delete",
      can_manage: "users.*",
    },
    branches: {
      can_view: "branches.view",
      can_create: "branches.create",
      can_edit: "branches.edit",
      can_delete: "branches.delete",
      can_manage: "branches.*",
    },
    reports: {
      can_view: "reports.view",
      can_export: "reports.export",
      can_manage: "reports.*",
    },
    settings: {
      can_view: "settings.view",
      can_edit: "settings.edit",
      can_manage: "settings.*",
    },
    profile: {
      can_view: "profile.view",
      can_edit: "profile.edit",
      can_manage: "profile.*",
    },
  };

  const actionKeys = [
    "can_view",
    "can_create",
    "can_edit",
    "can_delete",
    "can_export",
    "can_manage",
  ] as const;

  const parseDbPermissionGrants = (
    rows: Database["public"]["Tables"]["role_module_permissions"]["Row"][],
  ): PermissionGrant[] => {
    const grants = new Set<PermissionGrant>();

    for (const row of rows) {
      const actionMap = MODULE_ACTION_PERMISSION_MAP[row.module_key];
      if (!actionMap) {
        continue;
      }

      for (const actionKey of actionKeys) {
        if (row[actionKey] !== true) {
          continue;
        }

        const permission = actionMap[actionKey];
        if (permission) {
          grants.add(permission);
        }
      }
    }

    return Array.from(grants);
  };

  const loadRoleModulePermissions = async (
    roleId: string | null | undefined,
    options: { force?: boolean } = {},
  ) => {
    if (!roleId) {
      dbPermissionGrants.value = [];
      dbPermissionRoleId.value = null;
      dbPermissionFetchedAt.value = 0;
      return;
    }

    const forceRefresh = options.force === true;
    const hasFreshRolePermissions =
      dbPermissionRoleId.value === roleId
      && Date.now() - dbPermissionFetchedAt.value < PERMISSIONS_CACHE_TTL_MS;

    if (!forceRefresh && hasFreshRolePermissions) {
      return;
    }

    if (dbPermissionLoading.value) {
      let attempts = 0;
      while (dbPermissionLoading.value && attempts < 40) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 25);
        });
        attempts += 1;
      }

      if (!forceRefresh && (
        dbPermissionRoleId.value === roleId
        && Date.now() - dbPermissionFetchedAt.value < PERMISSIONS_CACHE_TTL_MS
      )) {
        return;
      }

      return;
    }

    dbPermissionLoading.value = true;

    try {
      const { data, error } = await supabase
        .from("role_module_permissions")
        .select("*")
        .eq("role_id", roleId);

      if (error) {
        throw error;
      }

      dbPermissionGrants.value = parseDbPermissionGrants(data ?? []);
      dbPermissionRoleId.value = roleId;
      dbPermissionFetchedAt.value = Date.now();
    } catch {
      dbPermissionGrants.value = [];
      dbPermissionRoleId.value = null;
      dbPermissionFetchedAt.value = 0;
    } finally {
      dbPermissionLoading.value = false;
    }
  };

  const ensureRolePermissionsLoaded = async (): Promise<void> => {
    const roleId = profile.value?.role_id ?? null;

    if (!roleId) {
      return;
    }

    if (dbPermissionRoleId.value === roleId) {
      return;
    }

    await loadRoleModulePermissions(roleId);
  };

  watch(
    () => profile.value?.role_id ?? null,
    async (roleId) => {
      if (!roleId) {
        dbPermissionGrants.value = [];
        dbPermissionRoleId.value = null;
        dbPermissionFetchedAt.value = 0;
        return;
      }

      await loadRoleModulePermissions(roleId);
    },
    { immediate: true },
  );

  watch(
    () => permissionsRevision.value,
    async () => {
      const roleId = profile.value?.role_id ?? null;
      if (!roleId) {
        dbPermissionGrants.value = [];
        dbPermissionRoleId.value = null;
        dbPermissionFetchedAt.value = 0;
        setPermissionGrants([]);
        return;
      }

      await loadRoleModulePermissions(roleId, { force: true });
    },
  );

  watch(
    () => [user.value?.id ?? null, profile.value?.id ?? null, profile.value?.organization_id ?? null, profile.value?.role ?? null] as const,
    () => {
      accessibleBranchesCache.value = {
        key: null,
        branches: [],
        fetchedAt: 0,
      };
      accessibleBranchesInFlight.clear();
    },
  );

  const getUserPermissions = (): PermissionGrant[] => {
    if (!profile.value) {
      return [];
    }

    const role = profile.value.role as UserRole;
    const hasDbPermissions =
      Boolean(profile.value.role_id)
      && dbPermissionRoleId.value === profile.value.role_id;
    let permissions = hasDbPermissions
      ? [...dbPermissionGrants.value]
      : [...(ROLE_PERMISSIONS[role] ?? [])];

    if (!isFeatureEnabled("feature_inventory_transfer")) {
      permissions = removePermission(permissions, "inventory.transfer");
    }

    if (!isFeatureEnabled("feature_advanced_reports")) {
      permissions = removePermission(permissions, "reports.advanced");
    }

    if (!isFeatureEnabled("feature_multi_branch")) {
      permissions = permissions.filter((permission) => !permission.startsWith("branches."));
    }

    const planPermissions = capabilities.value?.planPermissions;
    permissions = permissions.filter((permission) => {
      const moduleKey = resolvePermissionModule(permission);
      if (!moduleKey) {
        return true;
      }

      return resolvePlanPermission(planPermissions, moduleKey, true);
    });

    setPermissionGrants(permissions);
    return permissions;
  };

  const hasPermission = (
    userPermissions: PermissionGrant[],
    required: Permission,
  ): boolean => {
    return userPermissions.some((permission) => {
      if (permission.endsWith(".*")) {
        return required.startsWith(permission.slice(0, -1));
      }

      return permission === required;
    });
  };

  const canAccessBranch = async (branchId: string): Promise<boolean> => {
    if (!profile.value) {
      return false;
    }

    if (profile.value.role === "admin") {
      return true;
    }

    if (profile.value.role === "manager" || profile.value.role === "employee") {
      const branches = await getAccessibleBranches();
      return branches.some((branch) => branch.id === branchId);
    }

    return false;
  };

  const getAccessibleBranches = async (): Promise<AccessibleBranch[]> => {
    if (!profile.value) {
      return [];
    }

    const cacheKey = `${profile.value.id}:${profile.value.role}:${profile.value.organization_id ?? "none"}`;
    if (
      accessibleBranchesCache.value.key === cacheKey
      && Date.now() - accessibleBranchesCache.value.fetchedAt < PERMISSIONS_CACHE_TTL_MS
    ) {
      return accessibleBranchesCache.value.branches;
    }

    const inFlight = accessibleBranchesInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const branchPromise = (async (): Promise<AccessibleBranch[]> => {
      if (profile.value?.role === "admin") {
        if (!profile.value.organization_id) {
          return [];
        }

        const { data, error } = await supabase
          .from("branches")
          .select("id, name, code, address")
          .eq("organization_id", profile.value.organization_id)
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (error) {
          return [];
        }

        return (data ?? []).map((branch) => ({
          id: branch.id,
          name: branch.name,
          code: branch.code ?? null,
          address: branch.address ?? null,
        }));
      }

      if (profile.value?.role === "manager" || profile.value?.role === "employee") {
        const token = await resolveAccessToken();
        if (!token) {
          return [];
        }

        const response = await $fetch<{ branches: AccessibleBranch[] }>("/api/auth/accessible-branches", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const branches = response.branches ?? [];
        if (branches.length === 0) {
          return [];
        }

        return branches;
      }

      return [];
    })();

    accessibleBranchesInFlight.set(cacheKey, branchPromise);

    try {
      const branches = await branchPromise;
      accessibleBranchesCache.value = {
        key: cacheKey,
        branches,
        fetchedAt: Date.now(),
      };
      return branches;
    } finally {
      if (accessibleBranchesInFlight.get(cacheKey) === branchPromise) {
        accessibleBranchesInFlight.delete(cacheKey);
      }
    }
  };

  const resolveRouteAccess = async (
    meta: RoutePermissionMeta,
    branchId?: string | null,
  ): Promise<RouteAccessResolution> => {
    const currentRole = profile.value?.role as UserRole | undefined;

    if (meta.roles && (!currentRole || !meta.roles.includes(currentRole))) {
      return {
        allowed: false,
        reason: "role",
        context: {
          requiredRoles: meta.roles,
          userRole: currentRole ?? null,
        },
      };
    }

    if (meta.featureFlag && !isFeatureEnabled(meta.featureFlag)) {
      return {
        allowed: false,
        reason: "feature_flag",
        context: {
          featureFlag: meta.featureFlag,
        },
      };
    }

    if (meta.permission) {
      const userPermissions = getUserPermissions();

      if (!hasPermission(userPermissions, meta.permission)) {
        return {
          allowed: false,
          reason: "permission",
          context: {
            requiredPermission: meta.permission,
            userPermissions,
          },
        };
      }
    }

    if (branchId && !(await canAccessBranch(branchId))) {
      return {
        allowed: false,
        reason: "branch",
        context: {
          branchId,
        },
      };
    }

    return { allowed: true };
  };

  return {
    getUserPermissions,
    hasPermission,
    canAccessBranch,
    getAccessibleBranches,
    ensureRolePermissionsLoaded,
    resolveRouteAccess,
  };
};
