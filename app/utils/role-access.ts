import { getNavigationItems } from "../composables/useNavigation";
import { roleDefinitions, roleRoutePrefixes } from "./roles";
import type { UserRole } from "./roles";

export interface SidebarItem {
  label: string;
  to: string;
  icon: string;
  description?: string;
  children?: SidebarItem[];
  permission?: string;
}

export interface RoleLayoutConfig {
  title: string;
  homePath: string;
  allowedRoles: UserRole[];
  sidebarItems: SidebarItem[];
  profilePath: string;
  settingsPath: string;
  showBreadcrumbs: boolean;
  showNotifications: boolean;
  simplifiedHeader?: boolean;
}

export const roleLayoutConfigs: Record<UserRole, RoleLayoutConfig> = {
  admin: {
    title: "Administracion",
    homePath: roleDefinitions.admin!.homePath,
    allowedRoles: roleDefinitions.admin!.allowedRoles,
    sidebarItems: getNavigationItems("admin"),
    profilePath: roleDefinitions.admin!.profilePath,
    settingsPath: roleDefinitions.admin!.settingsPath,
    showBreadcrumbs: true,
    showNotifications: true,
  },
  manager: {
    title: "Gestion de Sucursal",
    homePath: roleDefinitions.manager!.homePath,
    allowedRoles: roleDefinitions.manager!.allowedRoles,
    sidebarItems: getNavigationItems("manager"),
    profilePath: roleDefinitions.manager!.profilePath,
    settingsPath: roleDefinitions.manager!.settingsPath,
    showBreadcrumbs: true,
    showNotifications: true,
  },
  employee: {
    title: "Operacion",
    homePath: roleDefinitions.employee!.homePath,
    allowedRoles: roleDefinitions.employee!.allowedRoles,
    sidebarItems: getNavigationItems("employee"),
    profilePath: roleDefinitions.employee!.profilePath,
    settingsPath: roleDefinitions.employee!.settingsPath,
    showBreadcrumbs: false,
    showNotifications: true,
    simplifiedHeader: true,
  },
  client: {
    title: "Mi Cuenta",
    homePath: roleDefinitions.client!.homePath,
    allowedRoles: roleDefinitions.client!.allowedRoles,
    sidebarItems: getNavigationItems("client"),
    profilePath: roleDefinitions.client!.profilePath,
    settingsPath: roleDefinitions.client!.settingsPath,
    showBreadcrumbs: false,
    showNotifications: false,
  },
};

export const getRoleLayoutConfigByPath = (path: string): RoleLayoutConfig | null => {
  const match = roleRoutePrefixes.find(({ prefix }) => path.startsWith(prefix));
  return match ? roleLayoutConfigs[match.role]! : null;
};

export const formatRoleLabel = (role: UserRole | null | undefined): string => {
  if (!role) {
    return "Invitado";
  }

  return roleDefinitions[role]!.label;
};

export const getDefaultPathForRole = (role: UserRole | null | undefined): string => {
  if (!role) {
    return "/auth/login";
  }

  return roleDefinitions[role]!.homePath;
};
