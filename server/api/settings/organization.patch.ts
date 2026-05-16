import { z } from "zod";

import { throwApiError } from "../../utils/http-error";
import { requireTenantContext } from "../../utils/tenant-context";
import { setCacheHeaders } from "../../utils/cache";

const updateOrgSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(120).optional(),
  slug: z.string().trim().min(4, "Minimo 4 caracteres").max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo letras minusculas, numeros y guiones").optional(),
  timezone: z.string().trim().min(1).max(60).optional(),
  currency_code: z.string().trim().length(3, "Moneda debe tener 3 caracteres").optional(),
  country: z.string().trim().length(2, "Pais debe tener 2 caracteres").optional(),
  business_type: z.enum(["products", "services", "hybrid"]).optional(),
  address: z.string().trim().max(300).nullable().optional(),
  is_active: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);

  if (context.role !== "admin") {
    throwApiError(403, "SETTINGS_ORG_ADMIN_ONLY", "Solo administradores pueden actualizar la organizacion.");
  }

  const body = await readBody(event);
  const parsed = updateOrgSchema.safeParse(body);

  if (!parsed.success) {
    throwApiError(
      400,
      "SETTINGS_ORG_INVALID_BODY",
      parsed.error.issues[0]?.message ?? "Payload invalido para actualizacion de organizacion.",
      parsed.error.flatten(),
    );
  }

  const updates = parsed.data as z.infer<typeof updateOrgSchema>;

  if (Object.keys(updates).length === 0) {
    throwApiError(400, "SETTINGS_ORG_NO_FIELDS", "No se enviaron campos para actualizar.");
  }

  if (updates.slug) {
    const { data: existingSlug } = await context.adminClient
      .from("organizations")
      .select("id")
      .eq("slug", updates.slug)
      .neq("id", context.organizationId)
      .maybeSingle();

    if (existingSlug) {
      throwApiError(409, "SETTINGS_ORG_SLUG_TAKEN", "Esta direccion virtual ya esta en uso.");
    }
  }

  const { data, error } = await context.adminClient
    .from("organizations")
    .update(updates)
    .eq("id", context.organizationId)
    .select("id, name, slug, timezone, currency_code, country, business_type, address, logo_url, is_active, updated_at")
    .single();

  if (error || !data) {
    throwApiError(
      500,
      "SETTINGS_ORG_UPDATE_ERROR",
      error?.message ?? "No se pudo actualizar la organizacion.",
      { organizationId: context.organizationId },
    );
  }

  setCacheHeaders(event, { sMaxAge: 0, staleWhileRevalidate: 0, visibility: "private" });
  return data;
});
