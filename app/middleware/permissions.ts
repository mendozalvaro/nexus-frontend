import type { Permission, RoutePermissionMeta } from "@/types/permissions";
import { getDefaultPathForRole } from "@/utils/role-access";
import { buildLoginRedirectPath } from "@/utils/redirect";

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
  const { resolvedRole } = useAuth();
  const { ensureAuthContext } = useAuthContext();
  let { user, profile, bootstrapState } = await ensureAuthContext({ requireProfile: true });

  if (!user) {
    console.info("[AUTH_REDIRECT]", { route: to.fullPath, reason: "unauthenticated", target: "login" });
    return navigateTo(buildLoginRedirectPath(to.fullPath));
  }

  // Guard against hydration races where user exists but profile is not synced yet.
  if (!profile && bootstrapState !== "profile_incomplete") {
    const refreshed = await ensureAuthContext({
      requireProfile: true,
      forceProfileRefresh: true,
      forceUserValidation: true,
    });
    user = refreshed.user;
    profile = refreshed.profile;
    bootstrapState = refreshed.bootstrapState;
  }

  if (!user || !profile) {
    if (bootstrapState === "profile_incomplete") {
      return navigateTo(getDefaultPathForRole(resolvedRole.value === "guest" ? null : resolvedRole.value));
    }

    console.info("[AUTH_REDIRECT]", { route: to.fullPath, reason: bootstrapState, target: "login" });
    return navigateTo(buildLoginRedirectPath(to.fullPath));
  }

  if (to.path.startsWith("/client/checkout") && resolvedRole.value === "guest") {
    return navigateTo(buildLoginRedirectPath(to.fullPath));
  }

  const fallbackPath = getDefaultPathForRole(profile?.role ?? null);

  const meta = to.meta as RoutePermissionMeta;
  const { getAccessibleBranches, resolveRouteAccess, ensureRolePermissionsLoaded } = usePermissions();
  const { selectedBranchId, restoreSelectedBranch } = useBranchSelector();
  const requiresScopedBranch = Boolean(meta.requiresBranch)
    && (profile?.role === "manager" || profile?.role === "employee");

  if (requiresScopedBranch && import.meta.client) {
    let accessibleBranches = await getAccessibleBranches();
    await restoreSelectedBranch(accessibleBranches);

    // Retry once to avoid false branch denials during profile/session hydration races.
    if (accessibleBranches.length === 0) {
      await ensureAuthContext({ requireProfile: true, forceProfileRefresh: true });
      accessibleBranches = await getAccessibleBranches();
      await restoreSelectedBranch(accessibleBranches);
    }

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
      console.info("[AUTH_REDIRECT]", { route: to.fullPath, reason: "branch_selection_required", target: "select-branch" });
      return navigateTo(`/select-branch?redirect=${encodeURIComponent(to.fullPath)}`);
    }
  }

  await ensureRolePermissionsLoaded();

  const requestedBranchId = resolveRequestedBranchId(to);
  const branchIdToValidate = requestedBranchId ?? (requiresScopedBranch ? selectedBranchId.value : null);
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
    console.info("[AUTH_REDIRECT]", { route: to.fullPath, reason: resolution.reason, target: fallbackPath });
    return navigateTo(fallbackPath);
  }
});
