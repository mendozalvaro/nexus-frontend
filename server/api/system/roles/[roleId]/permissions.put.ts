import { getRouterParam } from "h3";
import { z } from "zod";

import type { Database } from "@/types/database.types";
import {
  assertSystemModuleAccess,
  requireSystemAdminContext,
} from "../../../../utils/system-admin";

type RoleModulePermissionInsert =
  Database["public"]["Tables"]["role_module_permissions"]["Insert"];
type RoleModulePermissionRow =
  Database["public"]["Tables"]["role_module_permissions"]["Row"];

const modulePermissionSchema = z.object({
  moduleKey: z.string().trim().min(1, "El modulo es obligatorio."),
  canView: z.boolean().default(false),
  canCreate: z.boolean().default(false),
  canEdit: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  canExport: z.boolean().default(false),
  canManage: z.boolean().default(false),
  canApprove: z.boolean().default(false),
  canAssign: z.boolean().default(false),
});

const updateRolePermissionsSchema = z.object({
  permissions: z.array(modulePermissionSchema).min(1, "Debes enviar al menos un modulo."),
});

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "roles", "can_manage");
  const roleId = getRouterParam(event, "roleId");

  if (!roleId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Falta roleId en la ruta.",
    });
  }

  const body = await readBody(event);
  const parsed = updateRolePermissionsSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  const payload: RoleModulePermissionInsert[] = parsed.data.permissions.map((permission) => ({
    role_id: roleId,
    module_key: permission.moduleKey,
    can_view: permission.canView,
    can_create: permission.canCreate,
    can_edit: permission.canEdit,
    can_delete: permission.canDelete,
    can_export: permission.canExport,
    can_manage: permission.canManage,
    can_approve: permission.canApprove,
    can_assign: permission.canAssign,
  }));

  const { error } = await context.adminClient
    .from("role_module_permissions")
    .upsert(payload, { onConflict: "role_id,module_key" });

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message,
    });
  }

  const { data: rows, error: listError } = await context.adminClient
    .from("role_module_permissions")
    .select("*")
    .eq("role_id", roleId)
    .order("module_key", { ascending: true })
    .returns<RoleModulePermissionRow[]>();

  if (listError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron cargar los permisos actualizados.",
    });
  }

  return {
    rows: rows ?? [],
  };
});
