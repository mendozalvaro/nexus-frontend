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

export const usePermissions = () => {
  const supabase = useSupabaseClient<Database>();
  const { user, profile } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const { capabilities } = useSubscription();

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

  const MODULE_PERMISSION_PREFIXES: Record<string, string[]> = {
    pos: ["pos."],
    catalog: ["catalog."],
    inventory: ["inventory."],
    service_assignment: ["service_assignment."],
    appointments: ["appointments."],
    users: ["users."],
    branches: ["branches."],
    reports: ["reports."],
    settings: ["settings."],
    profile: ["profile."],
    api: [],
    forensic: [],
  };

  const removePermissionPrefixes = (
    permissions: PermissionGrant[],
    prefixes: string[],
  ): PermissionGrant[] => {
    return permissions.filter((permission) => {
      return !prefixes.some((prefix) => permission.startsWith(prefix));
    });
  };

  const getUserPermissions = (): PermissionGrant[] => {
    if (!profile.value) {
      return [];
    }

    const role = profile.value.role as UserRole;
    let permissions = [...(ROLE_PERMISSIONS[role] ?? [])];

    if (!isFeatureEnabled("feature_inventory_transfer")) {
      permissions = removePermission(permissions, "inventory.transfer");
    }

    if (!isFeatureEnabled("feature_advanced_reports")) {
      permissions = removePermission(permissions, "reports.advanced");
    }

    if (!isFeatureEnabled("feature_multi_branch")) {
      permissions = permissions.filter((permission) => !permission.startsWith("branches."));
    }

    const planPermissions = capabilities.value?.planPermissions ?? {};
    for (const [moduleKey, enabled] of Object.entries(planPermissions)) {
      if (enabled) {
        continue;
      }

      const prefixes = MODULE_PERMISSION_PREFIXES[moduleKey];
      if (!prefixes || prefixes.length === 0) {
        continue;
      }

      permissions = removePermissionPrefixes(permissions, prefixes);
    }

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
      if (profile.value.branch_id === branchId) {
        return true;
      }

      const assignmentUserId = profile.value.id ?? user.value?.id;
      if (!assignmentUserId) {
        return false;
      }

      const { data, error } = await supabase
        .from("employee_branch_assignments")
        .select("branch_id")
        .eq("user_id", assignmentUserId)
        .eq("branch_id", branchId)
        .maybeSingle();

      if (error) {
        return false;
      }

      return Boolean(data);
    }

    return false;
  };

  const getAccessibleBranches = async (): Promise<AccessibleBranch[]> => {
    if (!profile.value) {
      return [];
    }

    if (profile.value.role === "admin") {
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

    if (profile.value.role === "manager" || profile.value.role === "employee") {
      const branchIds = new Set<string>();

      if (profile.value.branch_id) {
        branchIds.add(profile.value.branch_id);
      }

      const assignmentUserId = profile.value.id ?? user.value?.id;
      if (assignmentUserId) {
        const { data: assignments, error: assignmentError } = await supabase
          .from("employee_branch_assignments")
          .select("branch_id")
          .eq("user_id", assignmentUserId);

        if (!assignmentError) {
          for (const assignment of assignments ?? []) {
            branchIds.add(assignment.branch_id);
          }
        }
      }

      const scopedBranchIds = Array.from(branchIds);
      if (scopedBranchIds.length === 0) {
        return [];
      }

      const { data: branches, error: branchError } = await supabase
        .from("branches")
        .select("id, name, code, address")
        .in("id", scopedBranchIds)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (branchError) {
        return [];
      }

      return (branches ?? []).map((branch) => ({
        id: branch.id,
        name: branch.name,
        code: branch.code ?? null,
        address: branch.address ?? null,
      }));
    }

    return [];
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
    resolveRouteAccess,
  };
};
