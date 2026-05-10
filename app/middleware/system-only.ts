import type { Database } from "@/types/database.types";
import { buildLoginRedirectPath } from "@/utils/redirect";
import { getDefaultPathForRole } from "@/utils/role-access";

export default defineNuxtRouteMiddleware(async (to) => {
  const { ensureAuthContext } = useAuthContext();
  const { profile, ensureContext } = useUserContext();
  const { user } = await ensureAuthContext();

  if (!user) {
    return navigateTo(buildLoginRedirectPath(to.fullPath));
  }

  const cacheKey = useState<string | null>("system-only:cache-key", () => null);
  const cacheValue = useState<boolean | null>("system-only:cache-value", () => null);
  const cacheFetchedAt = useState<number>("system-only:cache-fetched-at", () => 0);
  const nextCacheKey = user.id;
  const cacheIsFresh = cacheKey.value === nextCacheKey && Date.now() - cacheFetchedAt.value < 30_000;

  let hasSystemAccess = cacheIsFresh ? cacheValue.value === true : false;

  if (!cacheIsFresh) {
    const supabase = useSupabaseClient<Database>();
    const { data, error } = await supabase
      .from("system_users")
      .select("user_id, role, is_active")
      .eq("user_id", user.id)
      .maybeSingle();

    hasSystemAccess = Boolean(
      !error
      && data
      && data.is_active
      && (data.role === "system" || data.role === "support"),
    );

    cacheKey.value = nextCacheKey;
    cacheValue.value = hasSystemAccess;
    cacheFetchedAt.value = Date.now();
  }

  if (!hasSystemAccess) {
    const resolved = await ensureContext({ requireProfile: true });
    return navigateTo(getDefaultPathForRole(resolved.profile?.role ?? profile.value?.role ?? null));
  }

  return;
});
