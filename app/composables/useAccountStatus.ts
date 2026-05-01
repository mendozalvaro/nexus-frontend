import type { Database } from "@/types/database.types";

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

const DEFAULT_CACHE_MAX_AGE_MS = 20000;
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

  if (snapshot.organizationStatus === "active" && snapshot.subscriptionStatus === "active") {
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

type AccountStatusSnapshotRpcRow =
  Database["public"]["Functions"]["get_account_status_snapshot"]["Returns"][number];

export const useAccountStatus = () => {
  const supabase = useSupabaseClient<Database>();
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
    const { data, error } = await supabase.rpc("get_account_status_snapshot", {
      p_organization_id: organizationId,
    });

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as AccountStatusSnapshotRpcRow[];
    const snapshot = rows[0] ?? null;

    return {
      organizationStatus: snapshot?.organization_status ?? null,
      subscriptionStatus: snapshot?.subscription_status ?? null,
      isTrial: snapshot?.is_trial === true,
      trialEndsAt: typeof snapshot?.trial_ends_at === "string" ? snapshot.trial_ends_at : null,
      latestValidationStatus: snapshot?.latest_validation_status ?? null,
    };
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
