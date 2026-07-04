import { buildLoginRedirectPath } from "@/utils/redirect";
import { getDefaultPathForRole } from "@/utils/role-access";

export default defineNuxtRouteMiddleware(async (to) => {
  const { resolveActorContext } = useActorContext();
  const actor = await resolveActorContext({
    preferSystem: true,
    requireProfile: false,
  });

  if (!actor.user) {
    return navigateTo(buildLoginRedirectPath(to.fullPath));
  }

  if (actor.actorType !== "system") {
    return navigateTo(getDefaultPathForRole(actor.profile?.role ?? null));
  }

  return;
});
