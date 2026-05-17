import { z } from "zod";

import {
  assertSystemModuleAccess,
  requireSystemAdminContext,
} from "../../utils/system-admin";
import {
  getSystemProfile,
  updateSystemProfile,
  changeSystemPassword,
  type SystemProfileData,
} from "../../services/system/profile";

const profileUpdateSchema = z.object({
  email: z.string().email("Email invalido."),
  fullName: z.string().trim().min(2, "El nombre completo es obligatorio."),
  password: z
    .string()
    .min(8, "La contrasena debe tener al menos 8 caracteres.")
    .optional()
    .nullable(),
});

const passwordChangeSchema = z.object({
  current_password: z.string().min(1, "La contrasena actual es obligatoria."),
  new_password: z.string().min(8, "La nueva contrasena debe tener al menos 8 caracteres."),
});

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "system_users", "can_edit");

  const body = await readBody(event);

  if (body.current_password && body.new_password && !body.email && !body.fullName) {
    const parsed = passwordChangeSchema.safeParse(body);
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
      });
    }

    await changeSystemPassword(event, context.userId, parsed.data);
    const profile = await getSystemProfile(event, context.userId);
    return { row: profile as SystemProfileData };
  }

  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  const result = await updateSystemProfile(event, context.userId, parsed.data);
  return { row: result as SystemProfileData };
});
