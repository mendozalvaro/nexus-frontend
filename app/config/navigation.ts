import type { NavigationItem } from "@/types/permissions";
import {
  CLIENT_NAVIGATION_MODULES,
  MODULE_ACCESS_REGISTRY,
  TENANT_NAVIGATION_MODULES,
} from "@/utils/module-access.registry";

export const PENDING_ALLOWED_PATH_PREFIXES = [
  "/dashboard",
  "/catalogo",
  "/customers",
  "/users",
  "/branches",
  "/settings",
  "/inventory",
  "/service-assignment",
  "/profile",
  "/select-branch",
  "/reservations",
] as const;

export const PENDING_ACTIVATION_PATH = "/dashboard";

const toNavigationItem = (moduleKey: keyof typeof MODULE_ACCESS_REGISTRY): NavigationItem => {
  const entry = MODULE_ACCESS_REGISTRY[moduleKey];
  if (!entry.label || !entry.icon || !entry.to) {
    throw new Error(`Navigation entry incomplete for module ${moduleKey}`);
  }

  return {
    label: entry.label,
    icon: entry.icon,
    to: entry.to,
    roles: entry.roles,
    featureFlag: entry.featureFlag,
    requiresBranch: entry.requiresBranch,
    pendingAccess: entry.pendingAccess,
    moduleKey: entry.key,
    moduleKeysAny: entry.requiredAny,
    requiredBusinessTypes: entry.allowedBusinessTypes,
  };
};

export const NAVIGATION_ITEMS: NavigationItem[] = TENANT_NAVIGATION_MODULES.map(toNavigationItem);

export const CLIENT_NAVIGATION_ITEMS: NavigationItem[] = CLIENT_NAVIGATION_MODULES.map(toNavigationItem);

export const SYSTEM_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: "Resumen",
    icon: "i-heroicons-chart-pie",
    to: "/system",
  },
  {
    label: "Planes y Roles",
    icon: "i-heroicons-shield-check",
    to: "/system/access",
  },
  {
    label: "Validacion de pagos",
    icon: "i-heroicons-credit-card",
    to: "/system/payment-validations",
  },
  {
    label: "Usuarios",
    icon: "i-heroicons-users",
    to: "/system/users",
  },
  {
    label: "Perfil",
    icon: "i-heroicons-user-circle",
    to: "/system/profile",
  },
];
