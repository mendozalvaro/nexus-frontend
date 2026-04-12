import type { FeatureFlag } from "@/composables/useFeatureFlags";

export type UserRole = "admin" | "manager" | "employee" | "client";

export type Permission =
  | "pos.view"
  | "pos.create"
  | "pos.edit"
  | "pos.delete"
  | "catalog.view"
  | "catalog.edit"
  | "inventory.view"
  | "inventory.adjust"
  | "inventory.transfer"
  | "inventory.delete"
  | "service_assignment.view"
  | "service_assignment.edit"
  | "appointments.view"
  | "appointments.create"
  | "appointments.edit"
  | "appointments.delete"
  | "appointments.cancel"
  | "users.view"
  | "users.create"
  | "users.edit"
  | "users.delete"
  | "branches.view"
  | "branches.create"
  | "branches.edit"
  | "branches.delete"
  | "reports.view"
  | "reports.export"
  | "reports.advanced"
  | "settings.view"
  | "settings.edit"
  | "profile.view"
  | "profile.edit";

export type PermissionNamespace =
  | "pos"
  | "catalog"
  | "inventory"
  | "service_assignment"
  | "appointments"
  | "users"
  | "branches"
  | "reports"
  | "settings"
  | "profile";

export type PermissionGrant = Permission | `${PermissionNamespace}.*`;

export interface RoutePermissionMeta {
  permission?: Permission;
  roles?: UserRole[];
  featureFlag?: FeatureFlag;
  requiresBranch?: boolean;
}

export interface NavigationItem extends RoutePermissionMeta {
  label: string;
  icon: string;
  to: string;
  description?: string;
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
  reason?: "role" | "feature_flag" | "permission" | "branch";
  context?: Record<string, unknown>;
}

export const ROLE_PERMISSIONS: Record<UserRole, PermissionGrant[]> = {
  admin: [
    "pos.*",
    "catalog.*",
    "inventory.*",
    "service_assignment.*",
    "appointments.*",
    "users.*",
    "branches.*",
    "reports.*",
    "settings.*",
    "profile.*",
  ],
  manager: [
    "pos.view",
    "pos.create",
    "catalog.view",
    "catalog.edit",
    "inventory.view",
    "inventory.adjust",
    "service_assignment.view",
    "service_assignment.edit",
    "appointments.view",
    "appointments.create",
    "appointments.edit",
    "users.view",
    "users.create",
    "users.edit",
    "reports.view",
    "reports.export",
    "profile.*",
  ],
  employee: [
    "pos.view",
    "pos.create",
    "appointments.view",
    "appointments.create",
    "appointments.edit",
    "profile.*",
  ],
  client: [
    "appointments.view",
    "appointments.create",
    "appointments.cancel",
    "reports.view",
    "profile.*",
  ],
};

export const ROUTE_PERMISSIONS: Record<string, RoutePermissionMeta> = {
  "/dashboard": {
    permission: "profile.view",
    roles: ["admin", "manager", "employee"],
  },
  "/pos": {
    permission: "pos.view",
    roles: ["admin", "manager", "employee"],
    requiresBranch: true,
  },
  "/catalogo": {
    permission: "catalog.view",
    roles: ["admin", "manager"],
  },
  "/inventory": {
    permission: "inventory.view",
    roles: ["admin", "manager"],
    featureFlag: "feature_inventory",
    requiresBranch: true,
  },
  "/service-assignment": {
    permission: "service_assignment.view",
    roles: ["admin", "manager"],
  },
  "/appointments": {
    permission: "appointments.view",
    roles: ["admin", "manager", "employee"],
  },
  "/users": {
    permission: "users.view",
    roles: ["admin", "manager"],
  },
  "/branches": {
    permission: "branches.view",
    roles: ["admin"],
    featureFlag: "feature_multi_branch",
  },
  "/reports": {
    permission: "reports.view",
    roles: ["admin", "manager"],
  },
  "/settings": {
    permission: "settings.view",
    roles: ["admin"],
  },
  "/profile": {
    permission: "profile.view",
    roles: ["admin", "manager", "employee"],
  },
  "/client/dashboard": {
    permission: "profile.view",
    roles: ["client"],
  },
  "/client/appointments": {
    permission: "appointments.view",
    roles: ["client"],
  },
  "/client/bookings": {
    permission: "appointments.view",
    roles: ["client"],
  },
  "/client/reports": {
    permission: "reports.view",
    roles: ["client"],
  },
  "/client/profile": {
    permission: "profile.view",
    roles: ["client"],
  },
  "/select-branch": {
    permission: "profile.view",
    roles: ["admin", "manager", "employee"],
  },
  "/unauthorized": {
    permission: "profile.view",
    roles: ["admin", "manager", "employee", "client"],
  },
};
