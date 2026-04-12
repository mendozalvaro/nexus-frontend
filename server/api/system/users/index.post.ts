import { z } from "zod";

import type { Database, Json } from "@/types/database.types";
import { requireSystemAdminContext } from "../../../utils/system-admin";

type SystemUserRow = Database["public"]["Tables"]["system_users"]["Row"];
type SystemUserInsert = Database["public"]["Tables"]["system_users"]["Insert"];

const createSystemUserSchema = z.object({
  email: z.string().email("Email invalido."),
  fullName: z.string().trim().min(2, "El nombre completo es obligatorio."),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres."),
  role: z.enum(["system", "support"]).default("system"),
  permissions: z.any().optional().default([]),
  isActive: z.boolean().default(true),
});

export default defineEventHandler(async (event) => {
  const { adminClient, userId } = await requireSystemAdminContext(event);
  const body = await readBody(event);
  const parsedPayload = createSystemUserSchema.safeParse(body);
  if (!parsedPayload.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsedPayload.error.issues[0]?.message ?? "Payload invalido.",
    });
  }
  const payload = parsedPayload.data;

  const { data: createdAuth, error: createAuthError } =
    await adminClient.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.fullName,
      },
    });

  if (createAuthError || !createdAuth.user) {
    throw createError({
      statusCode: 400,
      statusMessage:
        createAuthError?.message ?? "No se pudo crear el usuario de autenticacion.",
    });
  }

  const insertRow: SystemUserInsert = {
    user_id: createdAuth.user.id,
    email: payload.email,
    full_name: payload.fullName,
    role: payload.role,
    permissions: (payload.permissions ?? []) as Json,
    is_active: payload.isActive,
    created_by: userId,
  };

  const { data: row, error: insertError } = await adminClient
    .from("system_users")
    .insert(insertRow)
    .select("*")
    .single<SystemUserRow>();

  if (insertError || !row) {
    await adminClient.auth.admin.deleteUser(createdAuth.user.id);
    throw createError({
      statusCode: 400,
      statusMessage:
        insertError?.message ?? "No se pudo crear el registro system_users.",
    });
  }

  return {
    row,
  };
});
