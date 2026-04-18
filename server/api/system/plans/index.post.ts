import { z } from "zod";

import type { Database, Json } from "@/types/database.types";
import {
  assertSystemModuleAccess,
  requireSystemAdminContext,
} from "../../../utils/system-admin";

type SubscriptionPlanInsert = Database["public"]["Tables"]["subscription_plans"]["Insert"];
type SubscriptionPlanRow = Database["public"]["Tables"]["subscription_plans"]["Row"];

const createPlanSchema = z.object({
  slug: z.string().trim().min(2, "El slug es obligatorio."),
  name: z.string().trim().min(2, "El nombre es obligatorio."),
  priceMonthly: z.number().nonnegative("El precio mensual no puede ser negativo."),
  priceYearly: z.number().nonnegative("El precio anual no puede ser negativo."),
  businessOnly: z.boolean().default(false),
  description: z.string().trim().default(""),
  resume: z.string().trim().default(""),
  features: z.array(z.string()).default([]),
  permissions: z.record(z.string(), z.boolean()).default({}),
  limits: z.record(z.string(), z.union([z.number(), z.boolean()])).default({}),
  availableBillingModes: z.record(z.string(), z.any()).default({}),
  trial: z.boolean().default(false),
  trialDuration: z.number().int().positive().nullable().optional(),
  maxBranches: z.number().int().positive().default(1),
  maxUsers: z.number().int().positive().default(1),
  isActive: z.boolean().default(true),
});

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "plans", "can_manage");
  const body = await readBody(event);

  const parsed = createPlanSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  const payload = parsed.data;
  const row: SubscriptionPlanInsert = {
    slug: payload.slug,
    name: payload.name,
    price_monthly: payload.priceMonthly,
    price_yearly: payload.priceYearly,
    business_only: payload.businessOnly,
    description: payload.description,
    resume: payload.resume,
    features: payload.features as Json,
    permissions: payload.permissions as Json,
    limits: payload.limits as Json,
    available_billing_modes: payload.availableBillingModes as Json,
    trial: payload.trial,
    trial_duration: payload.trial ? (payload.trialDuration ?? 30) : null,
    max_branches: payload.maxBranches,
    max_users: payload.maxUsers,
    is_active: payload.isActive,
  };

  const { data, error } = await context.adminClient
    .from("subscription_plans")
    .insert(row)
    .select("*")
    .single<SubscriptionPlanRow>();

  if (error || !data) {
    throw createError({
      statusCode: 400,
      statusMessage: error?.message ?? "No se pudo crear el plan.",
    });
  }

  return { row: data };
});
