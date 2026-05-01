import type { Ref } from "vue";

import type { Database, Json } from "@/types/database.types";
import type {
  CapabilityFeatureKey,
  OrganizationCapabilities,
  SubscriptionPlanSlug,
  SubscriptionResource,
} from "@/types/subscription";
import {
  flattenPlanLimits,
  readBooleanPlanPermissions,
  resolvePlanBooleanLimit,
  resolvePlanNumericLimit,
  resolvePlanPermission,
} from "@/utils/subscription-plan";

type CapabilityRpcResponse = Database["public"]["Functions"]["get_organization_capabilities"]["Returns"];

const FALLBACK_PLAN_NAME = "Emprende";
const FALLBACK_PLAN_SLUG: SubscriptionPlanSlug = "emprende";
const FALLBACK_MAX_BRANCHES = 1;
const FALLBACK_MAX_USERS = 1;
const CAPABILITIES_CACHE_MAX_AGE_MS = 20000;
const pendingCapabilityLoads = new Map<string, Promise<OrganizationCapabilities | null>>();

const FEATURE_KEYS: ReadonlySet<CapabilityFeatureKey> = new Set([
  "canCreateBranch",
  "canCreateManager",
  "canTransferStock",
  "hasAdvancedReports",
  "hasApiAccess",
  "hasForensicExport",
]);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const readString = (value: unknown, fallback = ""): string => {
  return typeof value === "string" ? value : fallback;
};

const readNullableString = (value: unknown): string | null => {
  return typeof value === "string" && value.length > 0 ? value : null;
};

const readBoolean = (value: unknown, fallback = false): boolean => {
  return typeof value === "boolean" ? value : fallback;
};

const readNumber = (value: unknown, fallback = 0): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
};

const sanitizePlanSlug = (value: unknown): SubscriptionPlanSlug => {
  return value === "crecimiento" || value === "enterprise" ? value : FALLBACK_PLAN_SLUG;
};

const sanitizeSubscriptionStatus = (
  value: unknown,
): OrganizationCapabilities["subscriptionStatus"] => {
  return value === "active" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "trial" ||
    value === "over_limit"
    ? value
    : "inactive";
};

const createFallbackCapabilities = (
  overrides: Partial<OrganizationCapabilities> = {},
): OrganizationCapabilities => {
  const currentBranchesCount = overrides.currentBranchesCount ?? 0;
  const currentUsersCount = overrides.currentUsersCount ?? 0;
  const maxBranches = overrides.maxBranches ?? FALLBACK_MAX_BRANCHES;
  const maxUsers = overrides.maxUsers ?? FALLBACK_MAX_USERS;

  return {
    planName: FALLBACK_PLAN_NAME,
    planSlug: FALLBACK_PLAN_SLUG,
    maxBranches,
    maxUsers,
    canCreateBranch: currentBranchesCount < maxBranches,
    canCreateManager: false,
    canTransferStock: false,
    hasAdvancedReports: false,
    hasApiAccess: false,
    hasForensicExport: false,
    currentBranchesCount,
    currentUsersCount,
    subscriptionStatus: "inactive",
    periodEnd: null,
    billingMode: null,
    isTrial: false,
    trialEndsAt: null,
    paymentMethod: null,
    paymentRequired: false,
    planPermissions: {},
    planLimits: {},
    planFeatures: [],
    ...overrides,
  };
};

const normalizeCapabilities = (payload: CapabilityRpcResponse): OrganizationCapabilities => {
  if (!isRecord(payload)) {
    return createFallbackCapabilities();
  }

  const planName = readString(payload.planName ?? payload.plan_name, FALLBACK_PLAN_NAME);
  const planSlug = sanitizePlanSlug(payload.planSlug ?? payload.plan_slug);
  const maxBranches = readNumber(
    payload.maxBranches ?? payload.max_branches,
    FALLBACK_MAX_BRANCHES,
  );
  const maxUsers = readNumber(payload.maxUsers ?? payload.max_users, FALLBACK_MAX_USERS);
  const currentBranchesCount = readNumber(
    payload.currentBranchesCount ?? payload.current_branches_count,
    0,
  );
  const currentUsersCount = readNumber(
    payload.currentUsersCount ?? payload.current_users_count,
    0,
  );

  return {
    planName,
    planSlug,
    maxBranches,
    maxUsers,
    canCreateBranch: readBoolean(
      payload.canCreateBranch ?? payload.can_create_branch,
      currentBranchesCount < maxBranches,
    ),
    canCreateManager: readBoolean(
      payload.canCreateManager ?? payload.can_create_manager,
      false,
    ),
    canTransferStock: readBoolean(
      payload.canTransferStock ?? payload.can_transfer_stock,
      false,
    ),
    hasAdvancedReports: readBoolean(
      payload.hasAdvancedReports ?? payload.has_advanced_reports,
      false,
    ),
    hasApiAccess: readBoolean(payload.hasApiAccess ?? payload.has_api_access, false),
    hasForensicExport: readBoolean(
      payload.hasForensicExport ?? payload.has_forensic_export,
      false,
    ),
    currentBranchesCount,
    currentUsersCount,
    subscriptionStatus: sanitizeSubscriptionStatus(
      payload.subscriptionStatus ?? payload.subscription_status,
    ),
    periodEnd: readNullableString(payload.periodEnd ?? payload.period_end),
    billingMode: readNullableString(payload.billingMode ?? payload.billing_mode) as OrganizationCapabilities["billingMode"],
    isTrial: readBoolean(payload.isTrial ?? payload.is_trial, false),
    trialEndsAt: readNullableString(payload.trialEndsAt ?? payload.trial_ends_at),
    paymentMethod: readNullableString(payload.paymentMethod ?? payload.payment_method) as OrganizationCapabilities["paymentMethod"],
    paymentRequired: readBoolean(payload.paymentRequired ?? payload.payment_required, false),
    planPermissions: readBooleanPlanPermissions(payload.permissions),
    planLimits: flattenPlanLimits(payload.limits),
    planFeatures: readStringArray(payload.features),
  };
};

export const useSubscription = () => {
  const supabase = useSupabaseClient<Database>();
  const { user, organizationId, ensureContext } = useUserContext();

  const capabilities = useState<OrganizationCapabilities | null>(
    "subscription:capabilities",
    () => createFallbackCapabilities(),
  ) as Ref<OrganizationCapabilities | null>;
  const isLoading = useState<boolean>("subscription:is-loading", () => false);
  const error = useState<string | null>("subscription:error", () => null);
  const resolvedOrganizationId = useState<string | null>("subscription:organization-id", () => null);
  const lastLoadedOrganizationId = useState<string | null>("subscription:last-loaded-org-id", () => null);
  const lastLoadedAt = useState<number>("subscription:last-loaded-at", () => 0);
  const watcherInitialized = useState<boolean>("subscription:watcher-initialized", () => false);

  const setFallbackCapabilities = (overrides: Partial<OrganizationCapabilities> = {}) => {
    capabilities.value = createFallbackCapabilities(overrides);
  };

  const getPlanNumericLimit = (candidates: string[]): number | null => {
    return resolvePlanNumericLimit(capabilities.value?.planLimits, candidates);
  };

  const hasPlanPermission = (moduleKey: string, fallback = true): boolean => {
    return resolvePlanPermission(capabilities.value?.planPermissions, moduleKey, fallback);
  };

  const resolveOrganizationId = async (): Promise<string | null> => {
    const { user: currentUser, profile } = await ensureContext({ requireProfile: true });
    if (!currentUser) {
      resolvedOrganizationId.value = null;
      return null;
    }
    const resolved = profile?.organization_id ?? organizationId.value ?? null;
    resolvedOrganizationId.value = resolved;
    return resolved;
  };

  /**
   * Carga las capacidades actuales de la organización usando la RPC segura
   * `get_organization_capabilities`.
   *
   * @example
   * ```ts
   * const { loadCapabilities } = useSubscription()
   * await loadCapabilities()
   * ```
   */
  const loadCapabilities = async (
    orgId?: string,
    options: { force?: boolean; maxAgeMs?: number } = {},
  ): Promise<OrganizationCapabilities | null> => {
    isLoading.value = true;
    error.value = null;

    try {
      const { user: currentUser } = await ensureContext({ requireProfile: false });
      if (!currentUser) {
        setFallbackCapabilities();
        resolvedOrganizationId.value = null;
        lastLoadedOrganizationId.value = null;
        lastLoadedAt.value = 0;
        return capabilities.value;
      }

      const organizationId = orgId ?? (await resolveOrganizationId());
      if (!organizationId) {
        setFallbackCapabilities({
          subscriptionStatus: "inactive",
        });
        return capabilities.value;
      }

      resolvedOrganizationId.value = organizationId;
      const force = options.force === true;
      const maxAgeMs = options.maxAgeMs ?? CAPABILITIES_CACHE_MAX_AGE_MS;
      const hasFreshCachedCapabilities =
        !force &&
        capabilities.value !== null &&
        lastLoadedOrganizationId.value === organizationId &&
        Date.now() - lastLoadedAt.value <= Math.max(0, maxAgeMs);

      if (hasFreshCachedCapabilities) {
        return capabilities.value;
      }

      if (!force && import.meta.client) {
        const pending = pendingCapabilityLoads.get(organizationId);
        if (pending) {
          return await pending;
        }
      }

      const loader = (async () => {
        const { data, error: rpcError } = await supabase.rpc(
          "get_organization_capabilities",
          { input_org_id: organizationId },
        );

        if (rpcError) {
          throw rpcError;
        }

        capabilities.value = normalizeCapabilities(data as Json);
        lastLoadedOrganizationId.value = organizationId;
        lastLoadedAt.value = Date.now();
        return capabilities.value;
      })();
      if (import.meta.client) {
        pendingCapabilityLoads.set(organizationId, loader);
      }
      try {
        return await loader;
      } finally {
        if (import.meta.client && pendingCapabilityLoads.get(organizationId) === loader) {
          pendingCapabilityLoads.delete(organizationId);
        }
      }
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar las capacidades de la suscripci\u00f3n.";

      error.value = message;
      setFallbackCapabilities();
      lastLoadedOrganizationId.value = null;
      lastLoadedAt.value = 0;
      return capabilities.value;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Indica si una capacidad booleana est\u00e1 habilitada para el plan actual.
   *
   * @example
   * ```ts
   * const { isFeatureEnabled } = useSubscription()
   * const canTransfer = isFeatureEnabled("canTransferStock")
   * ```
   */
  const isFeatureEnabled = (feature: CapabilityFeatureKey): boolean => {
    if (!capabilities.value || !FEATURE_KEYS.has(feature)) {
      return false;
    }

    const value = capabilities.value[feature];
    return typeof value === "boolean" ? value : false;
  };

  /**
   * Valida si la organizaci\u00f3n puede crear una nueva sucursal o usuario
   * seg\u00fan los l\u00edmites del plan cargado.
   *
   * @example
   * ```ts
   * const { canCreateResource } = useSubscription()
   * const canAddBranch = canCreateResource("branch")
   * ```
   */
  const canCreateResource = (resource: SubscriptionResource): boolean => {
    if (!capabilities.value) {
      return false;
    }

    if (resource === "branch") {
      const maxBranchesFromLimits = getPlanNumericLimit(["branches", "branches.max"]);
      if (maxBranchesFromLimits !== null) {
        return capabilities.value.currentBranchesCount < maxBranchesFromLimits;
      }
      return capabilities.value.canCreateBranch;
    }

    const usersUnlimited = resolvePlanBooleanLimit(capabilities.value.planLimits, [
      "users_unlimited",
      "users.unlimited",
      "usersUnlimited",
    ]);
    if (usersUnlimited === true) {
      return true;
    }

    const maxUsersFromLimits = getPlanNumericLimit(["users", "users.max", "seats", "seats.total"]);
    if (maxUsersFromLimits !== null) {
      return capabilities.value.currentUsersCount < maxUsersFromLimits;
    }
    return capabilities.value.currentUsersCount < capabilities.value.maxUsers;
  };

  /**
   * Retorna un mensaje de upgrade cuando el l\u00edmite del recurso ya fue alcanzado.
   *
   * @example
   * ```ts
   * const { getUpgradeMessage } = useSubscription()
   * const message = getUpgradeMessage("user")
   * ```
   */
  const getUpgradeMessage = (resource: SubscriptionResource): string | null => {
    if (!capabilities.value || canCreateResource(resource)) {
      return null;
    }

    if (resource === "branch") {
      const maxBranches = getPlanNumericLimit(["branches", "branches.max"]) ?? capabilities.value.maxBranches;
      return `Tu plan ${capabilities.value.planName} alcanz\u00f3 el l\u00edmite de ${maxBranches} sucursal(es). Actualiza tu suscripci\u00f3n para crear m\u00e1s sucursales.`;
    }

    const maxUsers = getPlanNumericLimit(["users", "users.max", "seats", "seats.total"]) ?? capabilities.value.maxUsers;
    return `Tu plan ${capabilities.value.planName} alcanz\u00f3 el l\u00edmite de ${maxUsers} usuario(s). Actualiza tu suscripci\u00f3n para agregar m\u00e1s usuarios.`;
  };

  /**
   * Eval\u00faa si la suscripci\u00f3n vence dentro de los pr\u00f3ximos N d\u00edas.
   *
   * @example
   * ```ts
   * const { isExpiringSoon } = useSubscription()
   * const expiringThisWeek = isExpiringSoon(7)
   * ```
   */
  const isExpiringSoon = (days = 7): boolean => {
    if (!capabilities.value?.periodEnd) {
      return false;
    }

    const periodEndTime = new Date(capabilities.value.periodEnd).getTime();
    if (Number.isNaN(periodEndTime)) {
      return false;
    }

    const thresholdInMs = Math.max(days, 0) * 24 * 60 * 60 * 1000;
    const now = Date.now();

    return periodEndTime >= now && periodEndTime - now <= thresholdInMs;
  };

  const watchedOrganizationId = computed(() => organizationId.value ?? resolvedOrganizationId.value);

  if (!watcherInitialized.value) {
    watcherInitialized.value = true;

    watch(
      [() => user.value?.id ?? null, watchedOrganizationId],
      async ([currentUserId, currentOrganizationId], [previousUserId, previousOrganizationId]) => {
        if (!currentUserId) {
          resolvedOrganizationId.value = null;
          error.value = null;
          setFallbackCapabilities();
          return;
        }

        if (
          currentUserId === previousUserId &&
          currentOrganizationId === previousOrganizationId &&
          capabilities.value
        ) {
          return;
        }

        await loadCapabilities(currentOrganizationId ?? undefined);
      },
      { immediate: true },
    );
  }

  return {
    capabilities,
    isLoading,
    error,
    loadCapabilities,
    isFeatureEnabled,
    hasPlanPermission,
    getPlanNumericLimit,
    canCreateResource,
    getUpgradeMessage,
    isExpiringSoon,
  };
};
