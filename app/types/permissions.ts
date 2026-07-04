import type { FeatureFlag } from "@/composables/useFeatureFlags";
import type { BusinessType, ModuleAccessKey } from "@/utils/module-access.registry";
import { ROLE_PERMISSION_GRANTS } from "@/utils/role-permission-matrix";

export type UserRole = "admin" | "manager" | "employee" | "client";

export type Permission =
  | "dashboard.view"
  | "clients.view"
  | "clients.edit"
  | "users.view"
  | "users.create"
  | "users.edit"
  | "users.delete"
  | "branches.view"
  | "branches.create"
  | "branches.edit"
  | "branches.delete"
  | "settings.view"
  | "settings.edit"
  | "profile.view"
  | "profile.edit"
  | "pos.sales.view"
  | "pos.sales.create"
  | "inventory.view"
  | "inventory.adjust"
  | "inventory.transfer"
  | "inventory.delete"
  | "appointments.view"
  | "appointments.create"
  | "appointments.edit"
  | "appointments.delete"
  | "appointments.cancel"
  | "service_assignment.view"
  | "service_assignment.edit"
  | "reservations.view"
  | "reservations.create"
  | "reservations.edit"
  | "reservations.cancel"
  | "catalog.products.view"
  | "catalog.products.edit"
  | "catalog.services.view"
  | "catalog.services.edit"
  | "catalog.rooms.view"
  | "catalog.rooms.edit"
  | "catalog.categories.products.view"
  | "catalog.categories.products.edit"
  | "catalog.categories.services.view"
  | "catalog.categories.services.edit"
  | "catalog.categories.rooms.view"
  | "catalog.categories.rooms.edit"
  | "reports.sales.view"
  | "reports.sales.export"
  | "reports.services.view"
  | "reports.services.export"
  | "reports.lodging.view"
  | "reports.lodging.export";

export type PermissionNamespace =
  | "dashboard"
  | "clients"
  | "users"
  | "branches"
  | "settings"
  | "profile"
  | "pos.sales"
  | "inventory"
  | "appointments"
  | "service_assignment"
  | "reservations"
  | "catalog.products"
  | "catalog.services"
  | "catalog.rooms"
  | "catalog.categories.products"
  | "catalog.categories.services"
  | "catalog.categories.rooms"
  | "reports.sales"
  | "reports.services"
  | "reports.lodging";

export type PermissionGrant = Permission | `${PermissionNamespace}.*`;
export type RoleFlagTemplate = Record<Permission, boolean>;
export type RoleTemplateKey = UserRole | "custom";

export interface RoutePermissionMeta {
  permission?: Permission;
  permissionsAny?: Permission[];
  roles?: UserRole[];
  featureFlag?: FeatureFlag;
  requiresBranch?: boolean;
  moduleKey?: ModuleAccessKey;
  moduleKeysAny?: ModuleAccessKey[];
  requiredBusinessTypes?: BusinessType[];
}

export interface NavigationItem extends RoutePermissionMeta {
  label: string;
  icon: string;
  to: string;
  description?: string;
  children?: NavigationItem[];
  pendingAccess?: "allowed" | "activation";
  badge?: string;
  disabled?: boolean;
  activationTo?: string;
}

export interface AccessibleBranch {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
}

export interface RouteAccessResolution {
  allowed: boolean;
  reason?: "role" | "feature_flag" | "permission" | "branch" | "business_type" | "module";
  context?: Record<string, unknown>;
}

export const ROLE_PERMISSIONS: Record<UserRole, PermissionGrant[]> = ROLE_PERMISSION_GRANTS;

export const PERMISSION_CATALOG = [
  "dashboard.view",
  "clients.view",
  "clients.edit",
  "users.view",
  "users.create",
  "users.edit",
  "users.delete",
  "branches.view",
  "branches.create",
  "branches.edit",
  "branches.delete",
  "settings.view",
  "settings.edit",
  "profile.view",
  "profile.edit",
  "pos.sales.view",
  "pos.sales.create",
  "inventory.view",
  "inventory.adjust",
  "inventory.transfer",
  "inventory.delete",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
  "appointments.delete",
  "appointments.cancel",
  "service_assignment.view",
  "service_assignment.edit",
  "reservations.view",
  "reservations.create",
  "reservations.edit",
  "reservations.cancel",
  "catalog.products.view",
  "catalog.products.edit",
  "catalog.services.view",
  "catalog.services.edit",
  "catalog.rooms.view",
  "catalog.rooms.edit",
  "catalog.categories.products.view",
  "catalog.categories.products.edit",
  "catalog.categories.services.view",
  "catalog.categories.services.edit",
  "catalog.categories.rooms.view",
  "catalog.categories.rooms.edit",
  "reports.sales.view",
  "reports.sales.export",
  "reports.services.view",
  "reports.services.export",
  "reports.lodging.view",
  "reports.lodging.export",
] as const satisfies Permission[];

const toPermissionNamespace = (permission: Permission): PermissionNamespace => {
  const parts = permission.split(".");
  return parts.slice(0, -1).join(".") as PermissionNamespace;
};

const buildRoleFlagTemplate = (grants: PermissionGrant[]): RoleFlagTemplate => {
  const scoped = new Set(grants);
  const template = {} as RoleFlagTemplate;

  for (const permission of PERMISSION_CATALOG) {
    const wildcard = `${toPermissionNamespace(permission)}.*` as PermissionGrant;
    template[permission] = scoped.has(permission) || scoped.has(wildcard);
  }

  return template;
};

export const ROLE_FLAG_TEMPLATES: Record<RoleTemplateKey, RoleFlagTemplate> = {
  admin: buildRoleFlagTemplate(ROLE_PERMISSIONS.admin),
  manager: buildRoleFlagTemplate(ROLE_PERMISSIONS.manager),
  employee: buildRoleFlagTemplate(ROLE_PERMISSIONS.employee),
  client: buildRoleFlagTemplate(ROLE_PERMISSIONS.client),
  custom: buildRoleFlagTemplate(ROLE_PERMISSIONS.employee),
};
