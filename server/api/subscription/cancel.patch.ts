import { z } from "zod";

import { throwApiError } from "../../utils/http-error";
import { requireTenantContext } from "../../utils/tenant-context";
import { setCacheHeaders } from "../../utils/cache";

const cancelSchema = z.object({
  confirm: z.literal(true),
  reason: z.string().trim().min(1).max(500).optional(),
});

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);

  if (context.role !== "admin") {
    throwApiError(403, "CANCEL_ADMIN_ONLY", "Solo administradores pueden cancelar la suscripcion.");
  }

  const body = await readBody(event);
  const parsed = cancelSchema.safeParse(body);

  if (!parsed.success) {
    throwApiError(
      400,
      "CANCEL_INVALID_BODY",
      parsed.error.issues[0]?.message ?? "Payload invalido para cancelacion.",
      parsed.error.flatten(),
    );
  }

  const { reason } = parsed.data!;

  const { data: existingSub, error: fetchError } = await context.adminClient
    .from("organization_subscriptions")
    .select("id, plan_id, status, cancel_at_period_end, current_period_end, billing_mode")
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (fetchError || !existingSub) {
    throwApiError(404, "CANCEL_SUB_NOT_FOUND", "No se encontro suscripcion.");
  }

  if (existingSub!.status === "canceled") {
    throwApiError(400, "CANCEL_ALREADY_CANCELED", "La suscripcion ya esta cancelada.");
  }

  if (existingSub!.cancel_at_period_end) {
    throwApiError(400, "CANCEL_ALREADY_SCHEDULED", "La cancelacion ya esta programada para el fin del periodo.");
  }

  const { data: updatedSub, error: updateError } = await context.adminClient
    .from("organization_subscriptions")
    .update({
      cancel_at_period_end: true,
    })
    .eq("organization_id", context.organizationId)
    .select("id, billing_mode, payment_method, status, current_period_end, cancel_at_period_end, updated_at")
    .single();

  if (updateError || !updatedSub) {
    throwApiError(500, "CANCEL_UPDATE_ERROR", updateError?.message ?? "No se pudo programar la cancelacion.");
  }

  const { data: plan } = await context.adminClient
    .from("subscription_plans")
    .select("id, name")
    .eq("id", existingSub!.plan_id)
    .single();

  await (context.adminClient as any).from("billing_ledger").insert({
    organization_id: context.organizationId,
    plan_id: existingSub!.plan_id,
    event_type: "cancellation",
    description: `Cancelacion programada para ${existingSub!.current_period_end}${reason ? ` - Motivo: ${reason}` : ""}`,
    billing_mode: existingSub!.billing_mode,
    metadata: {
      plan_name: plan?.name,
      reason: reason ?? null,
      period_end: existingSub!.current_period_end,
    },
    created_by: context.userId,
  });

  setCacheHeaders(event, { sMaxAge: 0, staleWhileRevalidate: 0, visibility: "private" });
  return {
    subscription: updatedSub,
    message: `Cancelacion programada. Acceso hasta ${existingSub!.current_period_end}.`,
  };
});
