import type { Database } from "@/types/database.types";
import {
  assertSystemModuleAccess,
  requireSystemAdminContext,
} from "../../../utils/system-admin";

type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"];
type RoleModulePermissionRow =
  Database["public"]["Tables"]["role_module_permissions"]["Row"];

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "roles", "can_view");

  const { data: roles, error: roleError } = await context.adminClient
    .from("user_roles")
    .select("*")
    .order("code", { ascending: true })
    .returns<UserRoleRow[]>();

  if (roleError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron cargar los roles globales.",
    });
  }

  const roleIds = (roles ?? []).map((role) => role.id);
  let permissions: RoleModulePermissionRow[] = [];

  if (roleIds.length > 0) {
    const { data, error } = await context.adminClient
      .from("role_module_permissions")
      .select("*")
      .in("role_id", roleIds)
      .order("module_key", { ascending: true })
      .returns<RoleModulePermissionRow[]>();

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: "No se pudieron cargar permisos por modulo de los roles.",
      });
    }

    permissions = data ?? [];
  }

  const permissionsByRole = permissions.reduce<Record<string, RoleModulePermissionRow[]>>(
    (accumulator, permission) => {
      const entries = accumulator[permission.role_id] ?? [];
      entries.push(permission);
      accumulator[permission.role_id] = entries;
      return accumulator;
    },
    {},
  );

  return {
    rows: (roles ?? []).map((role) => ({
      ...role,
      module_permissions: permissionsByRole[role.id] ?? [],
    })),
  };
});
