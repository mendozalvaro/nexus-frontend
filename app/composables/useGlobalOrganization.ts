import { CACHE_KEYS } from "@/utils/cache-keys";

export const useGlobalOrganization = () => {
  const { data, pending, refresh, error } = useFetch("/api/organization", {
    key: CACHE_KEYS.organization,
    lazy: true,
    dedupe: "defer",
    default: () => null,
  });

  return {
    organization: data,
    loading: pending,
    error,
    refreshOrganization: refresh,
  };
};
