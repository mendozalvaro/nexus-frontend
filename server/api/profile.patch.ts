import { z } from "zod";

import { requireTenantContext } from "../utils/tenant-context";
import {
  getTenantProfile,
  updateTenantProfile,
  changeTenantPassword,
  type TenantProfileData,
} from "../services/profile";

const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(1, "El nombre completo no puede estar vacio.").max(160).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  avatar_url: z.string().trim().url().nullable().optional(),
});

const passwordChangeSchema = z.object({
  current_password: z.string().min(1, "La contrasena actual es obligatoria."),
  new_password: z.string().min(8, "La nueva contrasena debe tener al menos 8 caracteres."),
});

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);
  const body = await readBody(event);

  if (body.current_password && body.new_password) {
    const parsed = passwordChangeSchema.safeParse(body);
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
      });
    }

    await changeTenantPassword(event, context.userId, parsed.data);
    return await getTenantProfile(event, context.userId);
  }

  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  const result = await updateTenantProfile(event, context.userId, context.organizationId, parsed.data);
  return result as TenantProfileData;
});
