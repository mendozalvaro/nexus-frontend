import { getRouterParam } from "h3";
import { z } from "zod";

import type { Database, Json } from "@/types/database.types";
import {
  assertSystemModuleAccess,
  requireSystemAdminContext,
} from "../../../utils/system-admin";

type SubscriptionPlanRow = Database["public"]["Tables"]["subscription_plans"]["Row"];
type SubscriptionPlanUpdate = Database["public"]["Tables"]["subscription_plans"]["Update"];

const updatePlanSchema = z.object({
  name: z.string().trim().min(2).optional(),
  priceMonthly: z.number().nonnegative().optional(),
  priceYearly: z.number().nonnegative().optional(),
  businessOnly: z.boolean().optional(),
  description: z.string().trim().optional(),
  resume: z.string().trim().optional(),
  features: z.array(z.string()).optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
  limits: z.record(z.string(), z.union([z.number(), z.boolean()])).optional(),
  availableBillingModes: z.record(z.string(), z.any()).optional(),
  trial: z.boolean().optional(),
  trialDuration: z.number().int().positive().nullable().optional(),
  maxBranches: z.number().int().positive().optional(),
  maxUsers: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "plans", "can_manage");
  const planId = getRouterParam(event, "planId");

  if (!planId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Falta planId en la ruta.",
    });
  }

  const body = await readBody(event);
  const parsed = updatePlanSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  const payload = parsed.data;
  const update: SubscriptionPlanUpdate = {};

  if (payload.name !== undefined) update.name = payload.name;
  if (payload.priceMonthly !== undefined) update.price_monthly = payload.priceMonthly;
  if (payload.priceYearly !== undefined) update.price_yearly = payload.priceYearly;
  if (payload.businessOnly !== undefined) update.business_only = payload.businessOnly;
  if (payload.description !== undefined) update.description = payload.description;
  if (payload.resume !== undefined) update.resume = payload.resume;
  if (payload.features !== undefined) update.features = payload.features as Json;
  if (payload.permissions !== undefined) update.permissions = payload.permissions as Json;
  if (payload.limits !== undefined) update.limits = payload.limits as Json;
  if (payload.availableBillingModes !== undefined) {
    update.available_billing_modes = payload.availableBillingModes as Json;
  }
  if (payload.trial !== undefined) update.trial = payload.trial;
  if (payload.trialDuration !== undefined) update.trial_duration = payload.trialDuration;
  if (payload.maxBranches !== undefined) update.max_branches = payload.maxBranches;
  if (payload.maxUsers !== undefined) update.max_users = payload.maxUsers;
  if (payload.isActive !== undefined) update.is_active = payload.isActive;

  const { data, error } = await context.adminClient
    .from("subscription_plans")
    .update(update)
    .eq("id", planId)
    .select("*")
    .single<SubscriptionPlanRow>();

  if (error || !data) {
    throw createError({
      statusCode: 400,
      statusMessage: error?.message ?? "No se pudo actualizar el plan.",
    });
  }

  return { row: data };
});
