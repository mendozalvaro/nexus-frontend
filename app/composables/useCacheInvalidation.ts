import { CACHE_KEYS } from "@/utils/cache-keys";

export const useCacheInvalidation = () => {
  const invalidate = async (key: string) => {
    const nuxtApp = useNuxtApp();

    if (nuxtApp.payload.data[key]) {
      delete nuxtApp.payload.data[key];
    }

    await refreshNuxtData(key);
  };

  const invalidateMany = async (keys: string[]) => {
    await Promise.all(keys.map((key) => invalidate(key)));
  };

  const invalidatePattern = async (pattern: string) => {
    const nuxtApp = useNuxtApp();
    const keys = Object.keys(nuxtApp.payload.data).filter((key) => key.startsWith(pattern));
    if (keys.length === 0) return;
    await invalidateMany(keys);
  };

  const invalidateOrganization = async () => invalidate(CACHE_KEYS.organization);
  const invalidateProfile = async () => invalidate(CACHE_KEYS.profile);
  const invalidateSubscription = async () => invalidate(CACHE_KEYS.subscription);
  const invalidateBranches = async () => invalidate(CACHE_KEYS.branches);
  const invalidateDashboard = async () => invalidatePattern(CACHE_KEYS.dashboardStats);

  const afterOrganizationUpdate = async () => {
    await invalidateMany([CACHE_KEYS.organization, CACHE_KEYS.initialData]);
    await invalidateDashboard();
  };

  const afterSubscriptionUpdate = async () => {
    await invalidateMany([CACHE_KEYS.subscription, CACHE_KEYS.initialData]);
  };

  const afterBranchUpdate = async () => {
    await invalidateMany([CACHE_KEYS.branches, CACHE_KEYS.initialData]);
    await invalidateDashboard();
  };

  return {
    invalidate,
    invalidateMany,
    invalidatePattern,
    invalidateOrganization,
    invalidateProfile,
    invalidateSubscription,
    invalidateBranches,
    invalidateDashboard,
    afterOrganizationUpdate,
    afterSubscriptionUpdate,
    afterBranchUpdate,
  };
};
