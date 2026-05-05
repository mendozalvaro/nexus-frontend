import { z } from "zod";

import { throwApiError } from "../utils/http-error";
import { requireTenantContext } from "../utils/tenant-context";

const updateProfileSchema = z.object({
  full_name: z.string().trim().min(1, "El nombre completo no puede estar vacío.").max(160).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  avatar_url: z.string().trim().url().nullable().optional(),
});

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);
  const body = await readBody(event);
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    throwApiError(
      400,
      "AUTH_PROFILE_UPDATE_INVALID_BODY",
      parsed.error.issues[0]?.message ?? "Payload inválido para actualización de perfil.",
      parsed.error.flatten(),
    );
  }

  const updates = parsed.data as z.infer<typeof updateProfileSchema>;
  const { data, error } = await context.adminClient
    .from("profiles")
    .update({
      full_name: updates.full_name,
      phone: updates.phone,
      avatar_url: updates.avatar_url,
    })
    .eq("id", context.userId)
    .eq("organization_id", context.organizationId)
    .select("id, full_name, email, role, organization_id, avatar_url, phone")
    .single();

  if (error || !data) {
    throwApiError(
      500,
      "AUTH_PROFILE_UPDATE_ERROR",
      error?.message ?? "No se pudo actualizar el perfil.",
      { userId: context.userId, organizationId: context.organizationId },
    );
  }

  return data;
});
