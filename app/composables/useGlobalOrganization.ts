import { CACHE_KEYS } from "@/utils/cache-keys";

export const useGlobalOrganization = () => {
  const route = useRoute();
  const { activeOrganizationId, role } = useUserContext();

  const shouldFetchOrganization = computed(() => {
    if (
      route.path === "/"
      || route.path.startsWith("/auth")
      || route.path.startsWith("/client")
      || route.path === "/terms"
      || route.path === "/privacy"
      || route.path.startsWith("/system")
    ) {
      return false;
    }

    return role.value !== "client" && Boolean(activeOrganizationId.value);
  });

  const { data, pending, refresh, error } = useFetch("/api/organization", {
    key: CACHE_KEYS.organization,
    lazy: true,
    dedupe: "defer",
    immediate: false,
    default: () => null,
  });

  watch(
    shouldFetchOrganization,
    async (enabled) => {
      if (!enabled) {
        return;
      }

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
