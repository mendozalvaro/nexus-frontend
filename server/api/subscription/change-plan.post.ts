import { z } from "zod";

import { throwApiError } from "../../utils/http-error";
import { requireTenantContext } from "../../utils/tenant-context";
import { setCacheHeaders } from "../../utils/cache";

const changePlanSchema = z.object({
  plan_slug: z.enum(["emprende", "crecimiento", "enterprise"]),
  billing_mode: z.enum(["monthly", "quarterly", "annual"]).optional(),
});

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);

  if (context.role !== "admin") {
    throwApiError(403, "CHANGE_PLAN_ADMIN_ONLY", "Solo administradores pueden cambiar de plan.");
  }

  const body = await readBody(event);
  const parsed = changePlanSchema.safeParse(body);

  if (!parsed.success) {
    throwApiError(
      400,
      "CHANGE_PLAN_INVALID_BODY",
      parsed.error.issues[0]?.message ?? "Payload invalido para cambio de plan.",
      parsed.error.flatten(),
    );
  }

  const { plan_slug, billing_mode } = parsed.data!;

  const { data: existingSub, error: fetchError } = await context.adminClient
    .from("organization_subscriptions")
    .select("id, plan_id, status, billing_mode, current_period_start, current_period_end")
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (fetchError || !existingSub) {
    throwApiError(404, "CHANGE_PLAN_SUB_NOT_FOUND", "No se encontro suscripcion activa.");
  }

  if (existingSub!.status === "canceled") {
    throwApiError(400, "CHANGE_PLAN_CANCELED", "No se puede cambiar plan de suscripcion cancelada.");
  }

  const { data: newPlan, error: planError } = await context.adminClient
    .from("subscription_plans")
    .select("id, slug, name, price_monthly, max_branches, max_users, permissions, limits, available_billing_modes")
    .eq("slug", plan_slug)
    .eq("is_active", true)
    .single();

  if (planError || !newPlan) {
    throwApiError(404, "CHANGE_PLAN_NOT_FOUND", "Plan no encontrado o no disponible.");
  }

  if (existingSub!.plan_id === newPlan!.id) {
    throwApiError(400, "CHANGE_PLAN_SAME", "Ya estas en este plan.");
  }

  const effectiveBillingMode = billing_mode ?? existingSub!.billing_mode ?? "monthly";

  const availableModes = (newPlan!.available_billing_modes as string[]) ?? ["monthly", "quarterly", "annual"];
  if (!availableModes.includes(effectiveBillingMode)) {
    throwApiError(400, "CHANGE_PLAN_BILLING_MODE", "Modo de facturacion no disponible para este plan.");
  }

  const now = new Date();
  const periodEnd = existingSub!.current_period_end ? new Date(existingSub!.current_period_end) : null;
  const periodStart = existingSub!.current_period_start ? new Date(existingSub!.current_period_start) : null;

  let prorationAmount: number | null = null;
  let prorationDescription: string | null = null;

  if (periodStart && periodEnd && periodEnd > now) {
    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const remainingRatio = remainingDays / totalDays;

    const { data: oldPlan, error: oldPlanError } = await context.adminClient
      .from("subscription_plans")
      .select("id, slug, price_monthly")
      .eq("id", existingSub!.plan_id)
      .single();

    if (!oldPlanError && oldPlan) {
      const oldMonthly = Number(oldPlan.price_monthly);
      const newMonthly = Number(newPlan!.price_monthly);
      const diff = newMonthly - oldMonthly;

      if (diff !== 0) {
        const multiplier = effectiveBillingMode === "annual" ? 12 : effectiveBillingMode === "quarterly" ? 3 : 1;
        prorationAmount = Math.round(diff * multiplier * remainingRatio * 100) / 100;
        prorationDescription = diff > 0
          ? `Upgrade ${oldPlan.slug} → ${newPlan!.slug} (${remainingDays} dias restantes)`
          : `Downgrade ${oldPlan.slug} → ${newPlan!.slug} (credito ${remainingDays} dias)`;
      }
    }
  }

  const newPeriodEnd = new Date(now);
  if (effectiveBillingMode === "annual") {
    newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
  } else if (effectiveBillingMode === "quarterly") {
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 3);
  } else {
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
  }

  const { data: updatedSub, error: updateError } = await context.adminClient
    .from("organization_subscriptions")
    .update({
      plan_id: newPlan!.id,
      billing_mode: effectiveBillingMode,
      current_period_start: now.toISOString(),
      current_period_end: newPeriodEnd.toISOString(),
      is_trial: false,
      trial_ends_at: null,
      status: "active",
    })
    .eq("organization_id", context.organizationId)
    .select("id, billing_mode, payment_method, status, current_period_end, updated_at")
    .single();

  if (updateError || !updatedSub) {
    throwApiError(500, "CHANGE_PLAN_UPDATE_ERROR", updateError?.message ?? "No se pudo actualizar el plan.");
  }

  await (context.adminClient as any).from("billing_ledger").insert({
    organization_id: context.organizationId,
    plan_id: newPlan!.id,
    event_type: "plan_change",
    amount: prorationAmount,
    description: prorationDescription ?? `Cambio de plan a ${newPlan!.name} (${effectiveBillingMode})`,
    billing_mode: effectiveBillingMode,
    metadata: {
      old_plan_id: existingSub!.plan_id,
      new_plan_slug: newPlan!.slug,
      proration_days: periodEnd ? Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null,
    },
    created_by: context.userId,
  });

  setCacheHeaders(event, { sMaxAge: 0, staleWhileRevalidate: 0, visibility: "private" });
  return {
    subscription: updatedSub,
    plan: { slug: newPlan!.slug, name: newPlan!.name },
    proration: prorationAmount !== null ? { amount: prorationAmount, description: prorationDescription } : null,
  };
});
