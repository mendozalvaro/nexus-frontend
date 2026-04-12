export default defineNuxtRouteMiddleware(async (to) => {
  const branchId =
    (typeof to.params.branchId === "string" ? to.params.branchId : null) ??
    (typeof to.query.branchId === "string" ? to.query.branchId : null);

  if (!branchId) {
    return;
  }

  const { canAccessBranch } = usePermissions();
  const hasAccess = await canAccessBranch(branchId);

  if (!hasAccess) {
    const { auditCriticalAction } = useAuth();

    await auditCriticalAction("PERMISSION_DENIED", "branch_access", {
      event: "PERMISSION_DENIED",
      route: to.path,
      branch_id: branchId,
    });

    return navigateTo("/dashboard");
  }
});
