import { z } from "zod";

import type { Database, Json } from "@/types/database.types";
import { requireSystemAdminContext } from "../../../utils/system-admin";

type SystemUserRow = Database["public"]["Tables"]["system_users"]["Row"];
type SystemUserUpdate = Database["public"]["Tables"]["system_users"]["Update"];

const updateSystemUserSchema = z.object({
  email: z.string().email("Email invalido."),
  fullName: z.string().trim().min(2, "El nombre completo es obligatorio."),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .optional()
    .nullable(),
  role: z.enum(["system", "support"]).default("system"),
  permissions: z.any().optional().default([]),
  isActive: z.boolean().default(true),
});

export default defineEventHandler(async (event) => {
  const { adminClient } = await requireSystemAdminContext(event);
  const userId = getRouterParam(event, "userId");

  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Falta el userId en la ruta.",
    });
  }

  const body = await readBody(event);
  const parsedPayload = updateSystemUserSchema.safeParse(body);
  if (!parsedPayload.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsedPayload.error.issues[0]?.message ?? "Payload invalido.",
    });
  }
  const payload = parsedPayload.data;

  const authUpdatePayload: {
    email?: string;
    password?: string;
    user_metadata?: Record<string, unknown>;
  } = {
    email: payload.email,
    user_metadata: {
      full_name: payload.fullName,
    },
  };

  if (payload.password) {
    authUpdatePayload.password = payload.password;
  }

  const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
    userId,
    authUpdatePayload,
  );

  if (updateAuthError) {
    throw createError({
      statusCode: 400,
      statusMessage: updateAuthError.message,
    });
  }

  const updateRow: SystemUserUpdate = {
    email: payload.email,
    full_name: payload.fullName,
    role: payload.role,
    permissions: (payload.permissions ?? []) as Json,
    is_active: payload.isActive,
    updated_at: new Date().toISOString(),
  };

  const { data: row, error: updateError } = await adminClient
    .from("system_users")
    .update(updateRow)
    .eq("user_id", userId)
    .select("*")
    .single<SystemUserRow>();

  if (updateError || !row) {
    throw createError({
      statusCode: 400,
      statusMessage:
        updateError?.message ?? "No se pudo actualizar el registro system_users.",
    });
  }

  return {
    row,
  };
});
