import type { AccessibleBranch } from "@/types/permissions";

export interface StartupWarmupOptions {
  forcedStatus?: string | null;
  force?: boolean;
  maxAgeMs?: number;
}

export interface StartupWarmupResult {
  userId: string | null;
  organizationId: string | null;
  branches: AccessibleBranch[];
  warmedAt: number;
}

const WARMUP_CACHE_MAX_AGE_MS = 20_000;
const pendingWarmups = new Map<string, Promise<StartupWarmupResult>>();

export const useStartupWarmup = () => {
  const { ensureAuthContext } = useAuthContext();
  const { loadCapabilities } = useSubscription();
  const { loadAccountStatus } = useAccountStatus();
  const { getAccessibleBranches } = usePermissions();

  const cache = useState<{
    key: string | null;
    result: StartupWarmupResult | null;
    fetchedAt: number;
  }>("startup:warmup-cache", () => ({
    key: null,
    result: null,
    fetchedAt: 0,
  }));

  const clearWarmupCache = () => {
    cache.value = {
      key: null,
      result: null,
      fetchedAt: 0,
    };
  };

  const warmupCurrentSession = async (
    options: StartupWarmupOptions = {},
  ): Promise<StartupWarmupResult> => {
    const force = options.force === true;
    const maxAgeMs = options.maxAgeMs ?? WARMUP_CACHE_MAX_AGE_MS;
    const authContext = await ensureAuthContext({ requireProfile: true });
    const currentUser = authContext.user;
    const currentProfile = authContext.profile;

    if (!currentUser || !currentProfile?.organization_id) {
      clearWarmupCache();
      return {
        userId: currentUser?.id ?? null,
        organizationId: null,
        branches: [],
        warmedAt: Date.now(),
      };
    }

    const organizationId = currentProfile.organization_id;
    const warmupKey = `${currentUser.id}:${organizationId}`;
    const hasFreshWarmup =
      !force
      && cache.value.key === warmupKey
      && cache.value.result
      && Date.now() - cache.value.fetchedAt <= Math.max(0, maxAgeMs);
    if (hasFreshWarmup) {
      const cachedResult = cache.value.result;
      if (cachedResult) {
        return cachedResult;
      }
    }

    if (!force) {
      const pending = pendingWarmups.get(warmupKey);
      if (pending) {
        return await pending;
      }
    }

    const loader = (async () => {
      const [, , branches] = await Promise.all([
        loadCapabilities(organizationId, { force, maxAgeMs }),
        loadAccountStatus({
          organizationId,
          forcedStatus: options.forcedStatus ?? null,
          force,
          maxAgeMs,
        }),
        getAccessibleBranches(),
      ]);

      const result: StartupWarmupResult = {
        userId: currentUser.id,
        organizationId,
        branches,
        warmedAt: Date.now(),
      };

      cache.value = {
        key: warmupKey,
        result,
        fetchedAt: result.warmedAt,
      };
      return result;
    })();

    if (!force) {
      pendingWarmups.set(warmupKey, loader);
    }

    try {
      return await loader;
    } finally {
      if (pendingWarmups.get(warmupKey) === loader) {
        pendingWarmups.delete(warmupKey);
      }
    }
  };

  return {
    warmupCurrentSession,
    clearWarmupCache,
  };
};
