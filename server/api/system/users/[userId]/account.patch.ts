import { z } from "zod";

import type { Database } from "@/types/database.types";
import { assertSystemModuleAccess, requireSystemAdminContext } from "../../../../utils/system-admin";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const accountActionSchema = z.object({
  scope: z.enum(["organization", "client"]),
  action: z.enum(["set_status", "reset_password"]),
  isActive: z.boolean().optional(),
});

const ensureProfileScope = (
  profile: Pick<ProfileRow, "role" | "organization_id">,
  scope: "organization" | "client",
) => {
  if (
    scope === "organization"
    && profile.organization_id
    && (profile.role === "admin" || profile.role === "manager" || profile.role === "employee")
  ) {
    return;
  }

  if (scope === "client" && profile.role === "client") {
    return;
  }

  throw createError({
    statusCode: 404,
    statusMessage: "El usuario no corresponde al alcance de la accion solicitada.",
  });
};

const generateTemporaryPassword = (): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);

  let result = "NxP!";
  for (const value of bytes) {
    result += alphabet[value % alphabet.length];
  }

  return result;
};

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
  const parsed = accountActionSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  const { scope, action, isActive } = parsed.data;

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, email, role, organization_id, is_active")
    .eq("id", userId)
    .maybeSingle<Pick<ProfileRow, "id" | "full_name" | "email" | "role" | "organization_id" | "is_active">>();

  if (profileError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo cargar el usuario objetivo.",
    });
  }

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "Usuario no encontrado.",
    });
  }

  ensureProfileScope(profile, scope);

  if (action === "set_status") {
    if (typeof isActive !== "boolean") {
      throw createError({
        statusCode: 400,
        statusMessage: "Debes enviar isActive para actualizar estado.",
      });
    }

    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      throw createError({
        statusCode: 500,
        statusMessage: "No se pudo actualizar el estado del usuario.",
      });
    }

    return {
      success: true as const,
      action,
      userId,
      isActive,
      message: isActive
        ? "Usuario desbloqueado correctamente."
        : "Usuario bloqueado correctamente.",
    };
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error: passwordError } = await adminClient.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
  });

  if (passwordError) {
    throw createError({
      statusCode: 400,
      statusMessage: passwordError.message,
    });
  }

  return {
    success: true as const,
    action,
    userId,
    temporaryPassword,
    message: `Contrasena temporal generada para ${profile.full_name ?? profile.email ?? "usuario"}.`,
  };
});

