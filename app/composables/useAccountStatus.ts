export type AccountStatusValue = "pending" | "active" | "rejected" | "suspended";

export interface AccountStatusSnapshot {
  organizationStatus: string | null;
  subscriptionStatus: string | null;
  isTrial: boolean;
  trialEndsAt: string | null;
  latestValidationStatus: string | null;
}

export interface AccountStatusResult {
  accountStatus: AccountStatusValue;
  paymentRequired: boolean;
  snapshot: AccountStatusSnapshot;
  fetchedAt: number;
}

export interface LoadAccountStatusOptions {
  organizationId?: string | null;
  forcedStatus?: string | null;
  force?: boolean;
  maxAgeMs?: number;
}

const DEFAULT_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const ACCOUNT_STATUS_FETCH_TIMEOUT_MS = 8000;
const pendingByOrganization = new Map<string, Promise<AccountStatusSnapshot>>();

const normalizeAccountStatus = (
  status: string | null | undefined,
): AccountStatusValue | "active" => {
  if (
    status === "pending" ||
    status === "active" ||
    status === "rejected" ||
    status === "suspended"
  ) {
    return status;
  }

  return "active";
};

const computePaymentRequired = (
  subscriptionStatus: string | null,
  isTrial: boolean,
  trialEndsAt: string | null,
): boolean => {
  if (!subscriptionStatus || subscriptionStatus === "active") {
    return false;
  }

  const trialEndsAtTime = typeof trialEndsAt === "string" ? new Date(trialEndsAt).getTime() : null;
  const trialExpired = typeof trialEndsAtTime === "number"
    && Number.isFinite(trialEndsAtTime)
    && trialEndsAtTime <= Date.now();

  return !isTrial || trialExpired || trialEndsAtTime === null;
};

const resolveAccountStatus = (
  snapshot: AccountStatusSnapshot,
  forcedStatus: AccountStatusValue | "active",
): AccountStatusValue => {
  const paymentRequired = computePaymentRequired(
    snapshot.subscriptionStatus,
    snapshot.isTrial,
    snapshot.trialEndsAt,
  );

  if (paymentRequired) {
    return "pending";
  }

  if (snapshot.organizationStatus === "suspended") {
    return "suspended";
  }

  if (
    snapshot.organizationStatus === "active"
    && (
      snapshot.subscriptionStatus === "active"
      || snapshot.subscriptionStatus === "trial"
    )
  ) {
    return "active";
  }

  if (forcedStatus !== "active") {
    return forcedStatus;
  }

  if (snapshot.latestValidationStatus === "rejected") {
    return "rejected";
  }

  return "pending";
};

const createActiveResult = (): AccountStatusResult => ({
  accountStatus: "active",
  paymentRequired: false,
  snapshot: {
    organizationStatus: null,
    subscriptionStatus: null,
    isTrial: false,
    trialEndsAt: null,
    latestValidationStatus: null,
  },
  fetchedAt: Date.now(),
});

const createPendingFallbackResult = (): AccountStatusResult => ({
  accountStatus: "pending",
  paymentRequired: false,
  snapshot: {
    organizationStatus: null,
    subscriptionStatus: null,
    isTrial: false,
    trialEndsAt: null,
    latestValidationStatus: null,
  },
  fetchedAt: Date.now(),
});

export const useAccountStatus = () => {
  const { resolveAccessToken } = useSessionAccess();
  const {
    profile,
    accountStatus,
    paymentRequired,
    setAccountStatusState,
  } = useUserContext();

  const cache = useState<{
    organizationId: string | null;
    snapshot: AccountStatusSnapshot;
    fetchedAt: number;
  } | null>("account-status:cache", () => null);
  const loading = useState<boolean>("account-status:loading", () => false);

  const clearAccountStatusCache = (organizationId?: string | null) => {
    if (!cache.value) {
      return;
    }

    if (!organizationId || cache.value.organizationId === organizationId) {
      cache.value = null;
    }
  };

  const fetchSnapshot = async (organizationId: string): Promise<AccountStatusSnapshot> => {
    const accessToken = await resolveAccessToken();
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    const response = await $fetch<{ snapshot: AccountStatusSnapshot }>("/api/account-status", {
      query: {
        organizationId,
      },
      timeout: ACCOUNT_STATUS_FETCH_TIMEOUT_MS,
      ...(headers ? { headers } : {}),
    });

    return response.snapshot;
  };

  const loadAccountStatus = async (
    options: LoadAccountStatusOptions = {},
  ): Promise<AccountStatusResult> => {
    const organizationId = options.organizationId ?? profile.value?.organization_id ?? null;
    const forcedStatus = normalizeAccountStatus(options.forcedStatus);
    const maxAgeMs = options.maxAgeMs ?? DEFAULT_CACHE_MAX_AGE_MS;
    const force = options.force === true;

    if (!organizationId) {
      const fallback = createActiveResult();
      cache.value = null;
      setAccountStatusState({
        accountStatus: fallback.accountStatus,
        paymentRequired: fallback.paymentRequired,
      });
      return fallback;
    }

    const cached = cache.value;
    if (
      !force &&
      cached &&
      cached.organizationId === organizationId &&
      Date.now() - cached.fetchedAt <= Math.max(0, maxAgeMs)
    ) {
      const paymentRequired = computePaymentRequired(
        cached.snapshot.subscriptionStatus,
        cached.snapshot.isTrial,
        cached.snapshot.trialEndsAt,
      );
      return {
        accountStatus: resolveAccountStatus(cached.snapshot, forcedStatus),
        paymentRequired,
        snapshot: cached.snapshot,
        fetchedAt: cached.fetchedAt,
      };
    }

    const canReusePending = import.meta.client && !force;
    let loader = canReusePending ? pendingByOrganization.get(organizationId) : null;
    if (!loader) {
      loader = fetchSnapshot(organizationId);
      if (canReusePending) {
        pendingByOrganization.set(organizationId, loader);
      }
    }

    loading.value = true;
    try {
      const snapshot = await loader;
      const fetchedAt = Date.now();
      cache.value = {
        organizationId,
        snapshot,
        fetchedAt,
      };

      const paymentRequired = computePaymentRequired(
        snapshot.subscriptionStatus,
        snapshot.isTrial,
        snapshot.trialEndsAt,
      );
      const resolvedStatus = resolveAccountStatus(snapshot, forcedStatus);
      setAccountStatusState({
        accountStatus: resolvedStatus,
        paymentRequired,
      });
      return {
        accountStatus: resolvedStatus,
        paymentRequired,
        snapshot,
        fetchedAt,
      };
    } catch {
      const staleCache =
        cache.value && cache.value.organizationId === organizationId
          ? cache.value
          : null;

      if (staleCache) {
        const stalePaymentRequired = computePaymentRequired(
          staleCache.snapshot.subscriptionStatus,
          staleCache.snapshot.isTrial,
          staleCache.snapshot.trialEndsAt,
        );
        const staleStatus = resolveAccountStatus(staleCache.snapshot, forcedStatus);
        setAccountStatusState({
          accountStatus: staleStatus,
          paymentRequired: stalePaymentRequired,
        });
        return {
          accountStatus: staleStatus,
          paymentRequired: stalePaymentRequired,
          snapshot: staleCache.snapshot,
          fetchedAt: staleCache.fetchedAt,
        };
      }

      const fallback = createPendingFallbackResult();
      setAccountStatusState({
        accountStatus: fallback.accountStatus,
        paymentRequired: fallback.paymentRequired,
      });
      return fallback;
    } finally {
      loading.value = false;
      if (canReusePending && pendingByOrganization.get(organizationId) === loader) {
        pendingByOrganization.delete(organizationId);
      }
    }
  };

  return {
    loading,
    accountStatus,
    paymentRequired,
    loadAccountStatus,
    clearAccountStatusCache,
  };
};
