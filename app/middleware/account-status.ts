import { getDefaultPathForRole } from "../utils/role-access";

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith("/onboarding/payment")) {
    return;
  }

  const { resolveActorContext } = useActorContext();
  const actor = await resolveActorContext({ requireProfile: true });

  if (!actor.user) {
    return navigateTo("/auth/login");
  }

  if (!actor.profile?.organization_id) {
    return navigateTo("/onboarding/organization");
  }

  if (actor.actorType === "client") {
    return navigateTo(getDefaultPathForRole(actor.profile?.role ?? null));
  }

  if (actor.actorType !== "staff") {
    return navigateTo("/auth/login");
  }

  const { loadAccountStatus } = useAccountStatus();
  const { accountStatus, snapshot } = await loadAccountStatus({
    organizationId: actor.profile.organization_id,
  });

  if (accountStatus === "active") {
    return navigateTo(getDefaultPathForRole(actor.profile.role));
  }

  if (actor.profile.role === "admin" && !snapshot.latestValidationStatus) {
    return navigateTo("/onboarding/payment");
  }

  return;
});
