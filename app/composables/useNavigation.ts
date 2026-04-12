import { CLIENT_NAVIGATION_ITEMS, NAVIGATION_ITEMS } from "@/config/navigation";
import type { UserRole } from "@/types/permissions";

export interface NavigationItem {
  label: string;
  to: string;
  icon: string;
  description?: string;
  children?: NavigationItem[];
  permission?: string;
  featureFlag?: string;
  roles?: UserRole[];
  requiresBranch?: boolean;
}

export const getNavigationItems = (
  role: UserRole,
  options?: {
    enabledPermissions?: string[];
    isFeatureEnabled?: (featureFlag: NavigationItem["featureFlag"]) => boolean;
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

    if (!item.permission || enabledPermissions.size === 0) {
      return true;
    }

    return enabledPermissions.has(item.permission) || enabledPermissions.has(`${item.permission.split(".")[0]}.*`);
  });
};

export const useNavigation = () => ({
  getNavigationItems,
});
