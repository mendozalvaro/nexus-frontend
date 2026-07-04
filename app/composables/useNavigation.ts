import type { NavigationItem } from "@/types/permissions";
import { CLIENT_NAVIGATION_ITEMS, NAVIGATION_ITEMS } from "@/config/navigation";
import type { UserRole } from "@/types/permissions";

export const getNavigationItems = (
  role: UserRole,
  options?: {
    enabledPermissions?: string[];
    isFeatureEnabled?: (featureFlag: NavigationItem["featureFlag"]) => boolean;
    hasBusinessType?: (businessType: string) => boolean;
  },
): NavigationItem[] => {
  const enabledPermissions = new Set(options?.enabledPermissions ?? []);
  const sourceItems = role === "client" ? CLIENT_NAVIGATION_ITEMS : NAVIGATION_ITEMS;

  return sourceItems.filter((item) => {
    if (item.roles && !item.roles.includes(role)) {
      return false;
    }

    if (item.featureFlag && options?.isFeatureEnabled && !options.isFeatureEnabled(item.featureFlag)) {
      return false;
    }

    if (
      item.requiredBusinessTypes
      && item.requiredBusinessTypes.length > 0
      && options?.hasBusinessType
      && !item.requiredBusinessTypes.some((businessType) => options.hasBusinessType!(businessType))
    ) {
      return false;
    }

    if (!item.permission || enabledPermissions.size === 0) {
      return true;
    }

    return enabledPermissions.has(item.permission);
  });
};

export const useNavigation = () => ({
  getNavigationItems,
});
