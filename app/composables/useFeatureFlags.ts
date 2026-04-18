import type { OrganizationCapabilities } from "@/types/subscription";

export type FeatureFlag =
  | "feature_inventory"
  | "feature_inventory_transfer"
  | "feature_multi_branch"
  | "feature_advanced_reports"
  | "feature_api_access"
  | "feature_forensic_export";

const FEATURE_FLAG_MAPPINGS: Record<
  FeatureFlag,
  (capabilities: OrganizationCapabilities) => boolean
> = {
  feature_inventory: (capabilities) =>
    (capabilities.planPermissions?.inventory
      ?? capabilities.canCreateBranch)
    || capabilities.canTransferStock
    || capabilities.hasAdvancedReports,
  feature_inventory_transfer: (capabilities) => capabilities.canTransferStock,
  feature_multi_branch: (capabilities) =>
    capabilities.planPermissions?.branches ?? capabilities.canCreateBranch,
  feature_advanced_reports: (capabilities) => capabilities.hasAdvancedReports,
  feature_api_access: (capabilities) => capabilities.hasApiAccess,
  feature_forensic_export: (capabilities) => capabilities.hasForensicExport,
};

export const useFeatureFlags = () => {
  const { capabilities, isLoading: subscriptionLoading } = useSubscription();

  const featureFlagsLoaded = computed(() => !subscriptionLoading.value);

  const isFeatureEnabled = (flag: FeatureFlag): boolean => {
    if (!capabilities.value) return false;
    const mapping = FEATURE_FLAG_MAPPINGS[flag];
    return mapping ? mapping(capabilities.value) : false;
  };

  const getFeatureFlags = (): Record<FeatureFlag, boolean> => {
    const flags: Record<FeatureFlag, boolean> = {} as Record<
      FeatureFlag,
      boolean
    >;
    for (const flag of Object.keys(FEATURE_FLAG_MAPPINGS) as FeatureFlag[]) {
      flags[flag] = isFeatureEnabled(flag);
    }
    return flags;
  };

  return {
    isFeatureEnabled,
    getFeatureFlags,
    featureFlagsLoaded,
  };
};
