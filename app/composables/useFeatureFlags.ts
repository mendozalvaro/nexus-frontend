import type { OrganizationCapabilities } from "@/types/subscription";

export type FeatureFlag =
  | "feature_inventory"
  | "feature_inventory_transfer"
  | "feature_multi_branch"
  | "feature_advanced_reports"
  | "feature_api_access"
  | "feature_forensic_export"
  | "feature_hotel_module";

const hasLodgingPermission = (capabilities: OrganizationCapabilities): boolean => {
  const permissions = capabilities.planPermissions ?? {};
  const features = new Set(capabilities.planFeatures ?? []);

  return permissions.reservations === true
    || permissions["catalog.rooms"] === true
    || permissions["reports.lodging"] === true
    || features.has("reservations")
    || features.has("catalog.rooms")
    || features.has("reports.lodging");
};

const FEATURE_FLAG_MAPPINGS: Record<
  FeatureFlag,
  (capabilities: OrganizationCapabilities) => boolean
> = {
  feature_inventory: (capabilities) =>
    capabilities.planPermissions?.inventory ?? false,
  feature_inventory_transfer: (capabilities) => capabilities.canTransferStock,
  feature_multi_branch: (capabilities) =>
    capabilities.planPermissions?.branches ?? capabilities.canCreateBranch,
  feature_advanced_reports: (capabilities) => capabilities.hasAdvancedReports,
  feature_api_access: (capabilities) => capabilities.hasApiAccess,
  feature_forensic_export: (capabilities) => capabilities.hasForensicExport,
  feature_hotel_module: (capabilities) =>
    (capabilities.hasHotelModule ?? false) || hasLodgingPermission(capabilities),
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
