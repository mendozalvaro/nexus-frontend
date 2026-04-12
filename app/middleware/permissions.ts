import type { Permission, RoutePermissionMeta } from "@/types/permissions";
import { getDefaultPathForRole } from "@/utils/role-access";

type RouteLike = {
  params: Record<string, unknown>;
  query: Record<string, unknown>;
};

const resolveRequestedBranchId = (to: RouteLike) => {
  const paramsBranchId = typeof to.params.branchId === "string" ? to.params.branchId : null;
  const queryBranchId = typeof to.query.branchId === "string" ? to.query.branchId : null;

  return paramsBranchId ?? queryBranchId;
};

const auditAccessDenied = async (
  route: string,
  reason: string,
  context: Record<string, unknown>,
) => {
  const { auditCriticalAction } = useAuth();

  await auditCriticalAction("PERMISSION_DENIED", "permissions", {
    event: "PERMISSION_DENIED",
    route,
    reason,
    ...context,
  });
};

export default defineNuxtRouteMiddleware(async (to) => {
  const { ensureAuthContext } = useAuthContext();
  const { user, profile } = await ensureAuthContext({ requireProfile: true });

  if (!user) {
    return navigateTo("/auth/login");
  }

  const fallbackPath = getDefaultPathForRole(profile?.role ?? null);

  const meta = to.meta as RoutePermissionMeta;
  const { getAccessibleBranches, resolveRouteAccess } = usePermissions();
  const { selectedBranchId, restoreSelectedBranch } = useBranchSelector();

  if (meta.requiresBranch && import.meta.client) {
    const accessibleBranches = await getAccessibleBranches();
    await restoreSelectedBranch(accessibleBranches);

    if (accessibleBranches.length === 0) {
      console.warn("[PERMISSIONS] Branch access denied:", {
        route: to.path,
        reason: "no_accessible_branches",
      });
      await auditAccessDenied(to.path, "branch", {
        branchId: null,
        selectedBranchId: selectedBranchId.value,
        userRole: profile?.role ?? null,
      });
      return navigateTo(fallbackPath);
    }

    if (!selectedBranchId.value) {
      return navigateTo(`/select-branch?redirect=${encodeURIComponent(to.fullPath)}`);
    }
  }

  const requestedBranchId = resolveRequestedBranchId(to);
  const branchIdToValidate = requestedBranchId ?? (meta.requiresBranch ? selectedBranchId.value : null);
  const resolution = await resolveRouteAccess(meta, branchIdToValidate);

  if (!resolution.allowed) {
    console.warn("[PERMISSIONS] Access denied:", {
      route: to.path,
      reason: resolution.reason,
      ...resolution.context,
    });
    await auditAccessDenied(to.path, resolution.reason ?? "unknown", {
      ...(resolution.context ?? {}),
      requiredPermission: (meta.permission ?? null) as Permission | null,
    });
    return navigateTo(fallbackPath);
  }
});
