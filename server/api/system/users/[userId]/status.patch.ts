import { z } from "zod";

import type { Database } from "@/types/database.types";
import {
  assertSystemModuleAccess,
  requireSystemAdminContext,
} from "../../../../utils/system-admin";

type SystemUserRow = Database["public"]["Tables"]["system_users"]["Row"];
type SystemUserUpdate = Database["public"]["Tables"]["system_users"]["Update"];

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "system_users", "can_manage");
  const { adminClient, userId: actorUserId } = context;
  const userId = getRouterParam(event, "userId");

  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Falta el userId en la ruta.",
    });
  }

  const body = await readBody(event);
  const parsedBody = updateStatusSchema.safeParse(body);

  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsedBody.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  if (actorUserId === userId && parsedBody.data.isActive === false) {
    throw createError({
      statusCode: 400,
      statusMessage: "No puedes desactivar tu propio usuario system.",
    });
  }

  const updatePayload: SystemUserUpdate = {
    is_active: parsedBody.data.isActive,
    updated_at: new Date().toISOString(),
  };

  const { data: row, error: updateError } = await adminClient
    .from("system_users")
    .update(updatePayload)
    .eq("user_id", userId)
    .select("*")
    .single<SystemUserRow>();

  if (updateError || !row) {
    throw createError({
      statusCode: 400,
      statusMessage:
        updateError?.message ?? "No se pudo actualizar el estado del usuario.",
    });
  }

  return {
    row,
  };
});
