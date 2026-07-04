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
import type { ModuleAccessKey } from "@/utils/module-access.registry";
import { MODULE_ACCESS_REGISTRY } from "@/utils/module-access.registry";
import { parseRoleModulePermissionGrants } from "@/utils/role-module-permissions";
import { resolvePlanPermission } from "@/utils/subscription-plan";

const PERMISSIONS_CACHE_TTL_MS = 30_000;
const accessibleBranchesInFlight = new Map<string, Promise<AccessibleBranch[]>>();

export const usePermissions = () => {
  const supabase = useSupabaseClient<Database>();
  const { user, profile, permissionsRevision, setPermissionGrants } = useUserContext();
  const { baseActorType, hasSystemAccess } = useActorContext();
  const { resolveAccessToken } = useSessionAccess();
  const { isFeatureEnabled } = useFeatureFlags();
  const { capabilities } = useSubscription();
  const { hasBusinessType } = useBusinessTypes();
  const dbPermissionGrants = useState<PermissionGrant[]>("permissions:db-grants", () => []);
  const dbPermissionRoleId = useState<string | null>("permissions:db-role-id", () => null);
  const dbPermissionState = useState<"idle" | "loaded" | "error">("permissions:db-state", () => "idle");
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
    const parts = permission.split(".");
    if (parts.length <= 1) {
      return "";
    }

    return parts.slice(0, -1).join(".");
  };

  const loadRoleModulePermissions = async (
    roleId: string | null | undefined,
    options: { force?: boolean } = {},
  ) => {
    if (!roleId) {
      dbPermissionGrants.value = [];
      dbPermissionRoleId.value = null;
      dbPermissionState.value = "idle";
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
      const token = await resolveAccessToken();
      if (!token) {
        throw new Error("Missing access token for role permissions.");
      }

      const response = await $fetch<{
        permissions: Database["public"]["Tables"]["role_module_permissions"]["Row"][];
      }>("/api/auth/role-permissions", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      dbPermissionGrants.value = parseRoleModulePermissionGrants(response.permissions ?? []);
      dbPermissionRoleId.value = roleId;
      dbPermissionState.value = "loaded";
      dbPermissionFetchedAt.value = Date.now();
    } catch {
      const canReuseCachedPermissions =
        dbPermissionRoleId.value === roleId
        && dbPermissionGrants.value.length > 0;

      if (!canReuseCachedPermissions) {
        dbPermissionGrants.value = [];
      }

      dbPermissionRoleId.value = roleId;
      dbPermissionState.value = "error";
      dbPermissionFetchedAt.value = 0;
    } finally {
      dbPermissionLoading.value = false;
    }
  };

  const ensureRolePermissionsLoaded = async (): Promise<void> => {
    if (hasSystemAccess.value || baseActorType.value !== "staff") {
      dbPermissionGrants.value = [];
      dbPermissionRoleId.value = null;
      dbPermissionState.value = "idle";
      dbPermissionFetchedAt.value = 0;
      return;
    }

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
      if (hasSystemAccess.value || baseActorType.value !== "staff") {
        dbPermissionGrants.value = [];
        dbPermissionRoleId.value = null;
        dbPermissionState.value = "idle";
        dbPermissionFetchedAt.value = 0;
        return;
      }

      if (!roleId) {
        dbPermissionGrants.value = [];
        dbPermissionRoleId.value = null;
        dbPermissionState.value = "idle";
        dbPermissionFetchedAt.value = 0;
        return;
      }

      await loadRoleModulePermissions(roleId);
    },
  );

  watch(
    () => permissionsRevision.value,
    async () => {
      if (hasSystemAccess.value || baseActorType.value !== "staff") {
        dbPermissionGrants.value = [];
        dbPermissionRoleId.value = null;
        dbPermissionState.value = "idle";
        dbPermissionFetchedAt.value = 0;
        setPermissionGrants([]);
        return;
      }

      const roleId = profile.value?.role_id ?? null;
      if (!roleId) {
        dbPermissionGrants.value = [];
        dbPermissionRoleId.value = null;
        dbPermissionState.value = "idle";
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
      setPermissionGrants([]);
      return [];
    }

    if (hasSystemAccess.value) {
      setPermissionGrants([]);
      return [];
    }

    const role = profile.value.role as UserRole;
    const actorType = baseActorType.value;
    const canUseStaticRoleFallback = actorType !== "staff" || !profile.value.role_id;
    const hasDbPermissions =
      actorType === "staff"
      &&
      Boolean(profile.value.role_id)
      && dbPermissionRoleId.value === profile.value.role_id;
    let permissions: PermissionGrant[] = [];

    if (canUseStaticRoleFallback) {
      permissions = [...(ROLE_PERMISSIONS[role] ?? [])];
    } else if (hasDbPermissions && dbPermissionState.value === "error") {
      permissions = [...dbPermissionGrants.value];
    } else if (hasDbPermissions) {
      permissions = dbPermissionGrants.value.length > 0
        ? [...dbPermissionGrants.value]
        : [...(ROLE_PERMISSIONS[role] ?? [])];
    }

    if (!isFeatureEnabled("feature_inventory_transfer")) {
      permissions = removePermission(permissions, "inventory.transfer");
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

  const hasAnyPermission = (
    userPermissions: PermissionGrant[],
    required: Permission[],
  ): boolean => required.some((permission) => hasPermission(userPermissions, permission));

  const hasModuleAccess = (moduleKey: ModuleAccessKey): boolean => {
    const definition = MODULE_ACCESS_REGISTRY[moduleKey];
    const currentRole = profile.value?.role as UserRole | undefined;
    const actorType = hasSystemAccess.value ? "system" : baseActorType.value;

    if (actorType === "system") {
      return false;
    }

    if (!definition || !currentRole || !definition.roles.includes(currentRole)) {
      return false;
    }

    if (
      definition.allowedBusinessTypes
      && definition.allowedBusinessTypes.length > 0
      && !definition.allowedBusinessTypes.some((businessType) => hasBusinessType(businessType))
    ) {
      return false;
    }

    if (definition.featureFlag && !isFeatureEnabled(definition.featureFlag)) {
      return false;
    }

    if (definition.requiredAny?.length) {
      return definition.requiredAny.some((nestedModuleKey) => hasModuleAccess(nestedModuleKey));
    }

    if (definition.requiredPlanPermission) {
      return resolvePlanPermission(
        capabilities.value?.planPermissions,
        definition.requiredPlanPermission,
        true,
      );
    }

    return true;
  };

  const canAccessBranch = async (branchId: string): Promise<boolean> => {
    if (!profile.value) {
      return false;
    }

    if (hasSystemAccess.value || baseActorType.value !== "staff") {
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
    if (!profile.value || hasSystemAccess.value || baseActorType.value !== "staff") {
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
    const actorType = hasSystemAccess.value ? "system" : baseActorType.value;

    if (actorType === "system") {
      return {
        allowed: false,
        reason: "role",
        context: {
          requiredRoles: meta.roles ?? null,
          actorType,
        },
      };
    }

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

    if (
      meta.requiredBusinessTypes
      && meta.requiredBusinessTypes.length > 0
      && !meta.requiredBusinessTypes.some((businessType) => hasBusinessType(businessType))
    ) {
      return {
        allowed: false,
        reason: "business_type",
        context: {
          requiredBusinessTypes: meta.requiredBusinessTypes,
          activeBusinessTypes: capabilities.value?.businessTypes ?? [],
        },
      };
    }

    if (meta.moduleKey && !hasModuleAccess(meta.moduleKey)) {
      return {
        allowed: false,
        reason: "module",
        context: {
          moduleKey: meta.moduleKey,
        },
      };
    }

    if (meta.moduleKeysAny && !meta.moduleKeysAny.some((moduleKey) => hasModuleAccess(moduleKey))) {
      return {
        allowed: false,
        reason: "module",
        context: {
          moduleKeysAny: meta.moduleKeysAny,
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

    if (meta.permissionsAny) {
      const userPermissions = getUserPermissions();

      if (!hasAnyPermission(userPermissions, meta.permissionsAny)) {
        return {
          allowed: false,
          reason: "permission",
          context: {
            requiredPermissions: meta.permissionsAny,
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
    hasAnyPermission,
    hasModuleAccess,
    canAccessBranch,
    getAccessibleBranches,
    ensureRolePermissionsLoaded,
    resolveRouteAccess,
  };
};
