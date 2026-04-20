import { z } from "zod";

import type { Database } from "@/types/database.types";
import { assertSystemModuleAccess, requireSystemAdminContext } from "../../../../utils/system-admin";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const emailActionSchema = z.object({
  action: z.enum(["confirm", "resend"]),
});

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "organizations", "can_manage");
  const { adminClient } = context;

  const userId = getRouterParam(event, "userId");
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Falta userId en la ruta.",
    });
  }

  const body = await readBody(event);
  const parsed = emailActionSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, email, role, organization_id")
    .eq("id", userId)
    .eq("role", "admin")
    .not("organization_id", "is", null)
    .maybeSingle<Pick<ProfileRow, "id" | "email" | "role" | "organization_id">>();

  if (profileError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar el usuario de organizacion.",
    });
  }

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "La accion solo aplica a usuarios admin de organizaciones.",
    });
  }

  if (!profile.email) {
    throw createError({
      statusCode: 400,
      statusMessage: "El usuario no tiene email registrado.",
    });
  }

  const action = parsed.data.action;

  if (action === "confirm") {
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    if (error) {
      throw createError({
        statusCode: 400,
        statusMessage: error.message,
      });
    }

    return {
      success: true as const,
      action,
      userId,
      message: `Email confirmado para ${profile.email}.`,
    };
  }

  const { error } = await adminClient.auth.resend({
    type: "signup",
    email: profile.email,
  });

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message,
    });
  }

  return {
    success: true as const,
    action,
    userId,
    message: `Email reenviado a ${profile.email}.`,
  };
});
