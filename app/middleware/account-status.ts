import { getDefaultPathForRole } from "../utils/role-access";

export default defineNuxtRouteMiddleware(async () => {
  const { ensureAuthContext } = useAuthContext();
  const { user, profile } = await ensureAuthContext({ requireProfile: true });

  if (!user) {
    return navigateTo("/auth/login");
  }

  if (!profile?.organization_id) {
    return navigateTo("/onboarding/organization");
  }

  if (profile.role === "client") {
    return navigateTo(getDefaultPathForRole(profile.role));
  }

  const { loadAccountStatus } = useAccountStatus();
  const { accountStatus, snapshot } = await loadAccountStatus({
    organizationId: profile.organization_id,
  });

  if (accountStatus === "active") {
    return navigateTo(getDefaultPathForRole(profile.role));
  }

  if (profile.role === "admin" && !snapshot.latestValidationStatus) {
    return navigateTo("/onboarding/payment");
  }

  return;
});
