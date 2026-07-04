import type { PermissionGrant, UserRole } from "@/types/permissions";

export type RoleModulePermissionAction =
  | "can_view"
  | "can_create"
  | "can_edit"
  | "can_delete"
  | "can_export"
  | "can_manage";

export type ModuleActionPermissionMap = Record<
  string,
  Partial<Record<RoleModulePermissionAction, PermissionGrant>>
>;

export const ROLE_MODULE_KEYS = [
  "dashboard",
  "clients",
  "users",
  "branches",
  "settings",
  "profile",
  "pos.sales",
  "inventory",
  "appointments",
  "service_assignment",
  "reservations",
  "catalog.products",
  "catalog.services",
  "catalog.rooms",
  "catalog.categories.products",
  "catalog.categories.services",
  "catalog.categories.rooms",
  "reports.sales",
  "reports.services",
  "reports.lodging",
] as const;

export const MODULE_ACTION_PERMISSION_MAP: ModuleActionPermissionMap = {
  dashboard: {
    can_view: "dashboard.view",
    can_manage: "dashboard.*",
  },
  "pos.sales": {
    can_view: "pos.sales.view",
    can_create: "pos.sales.create",
    can_manage: "pos.sales.*",
  },
  "catalog.products": {
    can_view: "catalog.products.view",
    can_edit: "catalog.products.edit",
    can_manage: "catalog.products.*",
  },
  "catalog.services": {
    can_view: "catalog.services.view",
    can_edit: "catalog.services.edit",
    can_manage: "catalog.services.*",
  },
  "catalog.rooms": {
    can_view: "catalog.rooms.view",
    can_edit: "catalog.rooms.edit",
    can_manage: "catalog.rooms.*",
  },
  "catalog.categories.products": {
    can_view: "catalog.categories.products.view",
    can_edit: "catalog.categories.products.edit",
    can_manage: "catalog.categories.products.*",
  },
  "catalog.categories.services": {
    can_view: "catalog.categories.services.view",
    can_edit: "catalog.categories.services.edit",
    can_manage: "catalog.categories.services.*",
  },
  "catalog.categories.rooms": {
    can_view: "catalog.categories.rooms.view",
    can_edit: "catalog.categories.rooms.edit",
    can_manage: "catalog.categories.rooms.*",
  },
  inventory: {
    can_view: "inventory.view",
    can_edit: "inventory.adjust",
    can_delete: "inventory.delete",
    can_manage: "inventory.*",
  },
  service_assignment: {
    can_view: "service_assignment.view",
    can_edit: "service_assignment.edit",
    can_manage: "service_assignment.*",
  },
  appointments: {
    can_view: "appointments.view",
    can_create: "appointments.create",
    can_edit: "appointments.edit",
    can_delete: "appointments.delete",
    can_manage: "appointments.*",
  },
  reservations: {
    can_view: "reservations.view",
    can_create: "reservations.create",
    can_edit: "reservations.edit",
    can_delete: "reservations.cancel",
    can_manage: "reservations.*",
  },
  clients: {
    can_view: "clients.view",
    can_edit: "clients.edit",
    can_manage: "clients.*",
  },
  users: {
    can_view: "users.view",
    can_create: "users.create",
    can_edit: "users.edit",
    can_delete: "users.delete",
    can_manage: "users.*",
  },
  branches: {
    can_view: "branches.view",
    can_create: "branches.create",
    can_edit: "branches.edit",
    can_delete: "branches.delete",
    can_manage: "branches.*",
  },
  "reports.sales": {
    can_view: "reports.sales.view",
    can_export: "reports.sales.export",
    can_manage: "reports.sales.*",
  },
  "reports.services": {
    can_view: "reports.services.view",
    can_export: "reports.services.export",
    can_manage: "reports.services.*",
  },
  "reports.lodging": {
    can_view: "reports.lodging.view",
    can_export: "reports.lodging.export",
    can_manage: "reports.lodging.*",
  },
  settings: {
    can_view: "settings.view",
    can_edit: "settings.edit",
    can_manage: "settings.*",
  },
  profile: {
    can_view: "profile.view",
    can_edit: "profile.edit",
    can_manage: "profile.*",
  },
} as const;

export const ROLE_PERMISSION_GRANTS: Record<UserRole, PermissionGrant[]> = {
  admin: [
    "dashboard.*",
    "clients.*",
    "users.*",
    "branches.*",
    "settings.*",
    "profile.*",
    "pos.sales.*",
    "inventory.*",
    "appointments.*",
    "service_assignment.*",
    "reservations.*",
    "catalog.products.*",
    "catalog.services.*",
    "catalog.rooms.*",
    "catalog.categories.products.*",
    "catalog.categories.services.*",
    "catalog.categories.rooms.*",
    "reports.sales.*",
    "reports.services.*",
    "reports.lodging.*",
  ],
  manager: [
    "dashboard.view",
    "clients.view",
    "clients.edit",
    "users.view",
    "users.create",
    "users.edit",
    "profile.*",
    "pos.sales.view",
    "pos.sales.create",
    "inventory.view",
    "inventory.adjust",
    "appointments.view",
    "appointments.create",
    "appointments.edit",
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
  ],
  employee: [
    "dashboard.view",
    "profile.*",
    "pos.sales.view",
    "pos.sales.create",
    "appointments.view",
    "appointments.create",
    "appointments.edit",
    "reservations.view",
    "reservations.create",
    "reservations.edit",
    "reservations.cancel",
  ],
  client: [
    "profile.view",
    "profile.edit",
    "appointments.view",
    "appointments.create",
    "appointments.cancel",
  ],
};
