import { z } from "zod";

import { throwApiError } from "../../utils/http-error";
import { requireTenantContext } from "../../utils/tenant-context";
import { setCacheHeaders } from "../../utils/cache";

const updateSubSchema = z.object({
  billing_mode: z.enum(["monthly", "quarterly", "annual"]).optional(),
  payment_method: z.enum(["tarjeta", "efectivo", "transferencia", "qr"]).optional(),
});

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);

  if (context.role !== "admin") {
    throwApiError(403, "SETTINGS_SUB_ADMIN_ONLY", "Solo administradores pueden actualizar la suscripcion.");
  }

  const body = await readBody(event);
  const parsed = updateSubSchema.safeParse(body);

  if (!parsed.success) {
    throwApiError(
      400,
      "SETTINGS_SUB_INVALID_BODY",
      parsed.error.issues[0]?.message ?? "Payload invalido para actualizacion de suscripcion.",
      parsed.error.flatten(),
    );
  }

  const updates = parsed.data as z.infer<typeof updateSubSchema>;

  if (Object.keys(updates).length === 0) {
    throwApiError(400, "SETTINGS_SUB_NO_FIELDS", "No se enviaron campos para actualizar.");
  }

  const { data: existingSub, error: fetchError } = await context.adminClient
    .from("organization_subscriptions")
    .select("id, status, plan_id")
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (fetchError || !existingSub) {
    throwApiError(
      404,
      "SETTINGS_SUB_NOT_FOUND",
      fetchError?.message ?? "No se encontro suscripcion para esta organizacion.",
    );
  }

  if (existingSub!.status === "canceled") {
    throwApiError(400, "SETTINGS_SUB_CANCELED", "No se puede modificar una suscripcion cancelada.");
  }

  const { data, error } = await context.adminClient
    .from("organization_subscriptions")
    .update(updates)
    .eq("organization_id", context.organizationId)
    .select("id, billing_mode, payment_method, status, current_period_end, updated_at")
    .single();

  if (error || !data) {
    throwApiError(
      500,
      "SETTINGS_SUB_UPDATE_ERROR",
      error?.message ?? "No se pudo actualizar la suscripcion.",
      { organizationId: context.organizationId },
    );
  }

  setCacheHeaders(event, { sMaxAge: 0, staleWhileRevalidate: 0, visibility: "private" });
  return data;
});
