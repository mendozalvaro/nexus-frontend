import { z } from "zod";

import type { Database } from "@/types/database.types";
import {
  assertSystemModuleAccess,
  requireSystemAdminContext,
} from "../../utils/system-admin";

type SystemUserRow = Database["public"]["Tables"]["system_users"]["Row"];
type SystemUserUpdate = Database["public"]["Tables"]["system_users"]["Update"];

const updateProfileSchema = z.object({
  email: z.string().email("Email invalido."),
  fullName: z.string().trim().min(2, "El nombre completo es obligatorio."),
  password: z
    .string()
    .min(8, "La contrasena debe tener al menos 8 caracteres.")
    .optional()
    .nullable(),
});

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "system_users", "can_edit");
  const { adminClient, userId } = context;

  const body = await readBody(event);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  const payload = parsed.data;

  const authPayload: {
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
    authPayload.password = payload.password;
  }

  const { error: authError } = await adminClient.auth.admin.updateUserById(
    userId,
    authPayload,
  );
  if (authError) {
    throw createError({
      statusCode: 400,
      statusMessage: authError.message,
    });
  }

  const updateRow: SystemUserUpdate = {
    email: payload.email,
    full_name: payload.fullName,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await adminClient
    .from("system_users")
    .update(updateRow)
    .eq("user_id", userId)
    .select("user_id, email, full_name, role, is_active, created_at, updated_at")
    .single<
      Pick<
        SystemUserRow,
        "user_id" | "email" | "full_name" | "role" | "is_active" | "created_at" | "updated_at"
      >
    >();

  if (error || !data) {
    throw createError({
      statusCode: 400,
      statusMessage: "No se pudo actualizar el perfil system.",
    });
  }

  return {
    row: data,
  };
});
