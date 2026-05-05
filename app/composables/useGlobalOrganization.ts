import { CACHE_KEYS } from "@/utils/cache-keys";

export const useGlobalOrganization = () => {
  const route = useRoute();
  const user = useSupabaseUser();

  const shouldFetchOrganization = computed(() => {
    // No hacer llamadas API en páginas públicas
    if (route.path === '/' || route.path.startsWith('/auth') || route.path === '/terms' || route.path === '/privacy') {
      return false;
    }

    if (!user.value) return false;

    const metadata = (user.value.user_metadata ?? {}) as Record<string, unknown>;
    const role = typeof metadata.role === "string" ? metadata.role : null;
    const organizationId = typeof metadata.organization_id === "string"
      ? metadata.organization_id
      : null;

    return role !== "system" && role !== "support" && Boolean(organizationId);
  });

  const { data, pending, refresh, error } = useFetch("/api/organization", {
    key: CACHE_KEYS.organization,
    lazy: true,
    dedupe: "defer",
    immediate: false, // Nunca ejecutar inmediatamente
    default: () => null,
  });

  watch(
    shouldFetchOrganization,
    async (enabled) => {
      if (!enabled) return;
      await refresh();
    },
    { immediate: false },
  );

  return {
    organization: data,
    loading: pending,
    error,
    refreshOrganization: refresh,
  };
};
