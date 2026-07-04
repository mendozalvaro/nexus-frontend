import type { Database } from "@/types/database.types";
import type { PermissionGrant, UserRole } from "@/types/permissions";
import {
  ROLE_PERMISSION_GRANTS,
  MODULE_ACTION_PERMISSION_MAP,
  type RoleModulePermissionAction,
} from "@/utils/role-permission-matrix";

type RoleModulePermissionRow = Database["public"]["Tables"]["role_module_permissions"]["Row"];

export type RoleModulePermissionPayload = Pick<
  RoleModulePermissionRow,
  | "module_key"
  | "can_view"
  | "can_create"
  | "can_edit"
  | "can_delete"
  | "can_export"
  | "can_manage"
>;

const actionKeys = [
  "can_view",
  "can_create",
  "can_edit",
  "can_delete",
  "can_export",
  "can_manage",
] as const satisfies RoleModulePermissionAction[];

const hasPermissionGrant = (
  grants: ReadonlySet<PermissionGrant>,
  permission: PermissionGrant | undefined,
): boolean => {
  if (!permission) {
    return false;
  }

  if (grants.has(permission)) {
    return true;
  }

  if (!permission.endsWith(".*")) {
    const wildcard = `${permission.split(".").slice(0, -1).join(".")}.*` as PermissionGrant;
    return grants.has(wildcard);
  }

  return false;
};

export const parseRoleModulePermissionGrants = (
  rows: RoleModulePermissionPayload[],
): PermissionGrant[] => {
  const grants = new Set<PermissionGrant>();

  for (const row of rows) {
    const actionMap = MODULE_ACTION_PERMISSION_MAP[row.module_key];
    if (!actionMap) {
      continue;
    }

    for (const actionKey of actionKeys) {
      if (row[actionKey] !== true) {
        continue;
      }

      const permission = actionMap[actionKey];
      if (permission) {
        grants.add(permission);
      }
    }
  }

  return Array.from(grants);
};

export const buildRoleModulePermissionFallback = (
  role: UserRole,
): RoleModulePermissionPayload[] => {
  const grants = new Set<PermissionGrant>(ROLE_PERMISSION_GRANTS[role] ?? []);

  return Object.entries(MODULE_ACTION_PERMISSION_MAP).map(([moduleKey, actionMap]) => ({
    module_key: moduleKey,
    can_view: hasPermissionGrant(grants, actionMap.can_view),
    can_create: hasPermissionGrant(grants, actionMap.can_create),
    can_edit: hasPermissionGrant(grants, actionMap.can_edit),
    can_delete: hasPermissionGrant(grants, actionMap.can_delete),
    can_export: hasPermissionGrant(grants, actionMap.can_export),
    can_manage: hasPermissionGrant(grants, actionMap.can_manage),
  })).filter((row) =>
    row.can_view
    || row.can_create
    || row.can_edit
    || row.can_delete
    || row.can_export
    || row.can_manage,
  );
};
