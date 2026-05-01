import { CACHE_KEYS } from "@/utils/cache-keys";

export const useGlobalUserProfile = () => {
  const route = useRoute();
  const user = useSupabaseUser();

  const shouldFetchTenantProfile = computed(() => {
    if (!user.value) return false;
    if (route.path.startsWith("/system")) return false;
    if (import.meta.client && window.location.pathname.startsWith("/system")) return false;

    const metadata = (user.value.user_metadata ?? {}) as Record<string, unknown>;
    const role = typeof metadata.role === "string" ? metadata.role : null;
    const organizationId = typeof metadata.organization_id === "string"
      ? metadata.organization_id
      : null;

    return role !== "system" && role !== "support" && Boolean(organizationId);
  });

  const { data, pending, refresh, error } = useFetch("/api/profile", {
    key: CACHE_KEYS.profile,
    lazy: true,
    dedupe: "defer",
    immediate: shouldFetchTenantProfile.value,
    default: () => null,
  });

  watch(
    shouldFetchTenantProfile,
    async (enabled) => {
      if (!enabled) return;
      await refresh();
    },
    { immediate: false },
  );

  return {
    profile: data,
    loading: pending,
    error,
    refreshProfile: refresh,
  };
};
