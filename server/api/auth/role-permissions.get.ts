import type { Database } from "@/types/database.types";
import type { UserRole } from "@/types/permissions";
import { buildRoleModulePermissionFallback } from "@/utils/role-module-permissions";
import { throwApiError } from "../../utils/http-error";
import { requireStaffTenantContext } from "../../utils/tenant-context";

type RoleModulePermissionRow =
  Database["public"]["Tables"]["role_module_permissions"]["Row"];

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);

  if (!context.profile.role_id) {
    return { permissions: [] };
  }

  const { data, error } = await context.adminClient
    .from("role_module_permissions")
    .select("*")
    .eq("role_id", context.profile.role_id)
    .order("module_key", { ascending: true })
    .returns<RoleModulePermissionRow[]>();

  if (error) {
    throwApiError(
      500,
      "AUTH_ROLE_PERMISSIONS_FETCH_ERROR",
      error.message,
      { roleId: context.profile.role_id, organizationId: context.organizationId },
    );
  }

  return {
    permissions: data && data.length > 0
      ? data
      : buildRoleModulePermissionFallback(context.profile.role as UserRole),
  };
});
