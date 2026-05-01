import { CACHE_KEYS } from "@/utils/cache-keys";

export const useGlobalSubscription = () => {
  const { data, pending, refresh, error } = useFetch<{
    plan?: Record<string, unknown> | null;
  } | null>("/api/subscription", {
    key: CACHE_KEYS.subscription,
    lazy: true,
    dedupe: "defer",
    default: () => null,
  });

  const plan = computed(() => data.value?.plan ?? null);
  const isFeatureEnabled = (feature: string): boolean => {
    return plan.value?.[feature] === true;
  };

  return {
    subscription: data,
    plan,
    loading: pending,
    error,
    refreshSubscription: refresh,
    isFeatureEnabled,
  };
};
