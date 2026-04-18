import { getRouterParam } from "h3";
import { z } from "zod";

import type { Database } from "@/types/database.types";
import {
  assertSystemModuleAccess,
  requireSystemAdminContext,
} from "../../../utils/system-admin";

type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"];
type UserRoleUpdate = Database["public"]["Tables"]["user_roles"]["Update"];

const updateRoleSchema = z.object({
  name: z.string().trim().min(2, "El nombre del rol es obligatorio."),
  description: z.string().trim().default(""),
  isActive: z.boolean().default(true),
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
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  const payload: UserRoleUpdate = {
    name: parsed.data.name,
    description: parsed.data.description,
    is_active: parsed.data.isActive,
    updated_at: new Date().toISOString(),
  };

  const { data: role, error } = await context.adminClient
    .from("user_roles")
    .update(payload)
    .eq("id", roleId)
    .select("*")
    .single<UserRoleRow>();

  if (error || !role) {
    throw createError({
      statusCode: 400,
      statusMessage: error?.message ?? "No se pudo actualizar el rol global.",
    });
  }

  return { row: role };
});
