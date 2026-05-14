import { createClient } from "@supabase/supabase-js";
import { createError } from "h3";

import type { H3Event } from "h3";
import type { Database } from "@/types/database.types";

type AdminClient = ReturnType<typeof createClient<Database>>;

const buildPublicClient = (event: H3Event): AdminClient => {
  const config = useRuntimeConfig(event);
  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = config.supabaseServiceRoleKey as string | undefined;

  if (!supabaseUrl || !serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Configuracion de Supabase incompleta.",
    });
  }

  return createClient<Database, "public">(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export interface PublicPlan {
  slug: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  description: string | null;
  features: unknown;
  limits: unknown;
  availableBillingModes: unknown;
}

export async function getPublicPlans(event: H3Event): Promise<PublicPlan[]> {
  const adminClient = buildPublicClient(event);

  const { data, error } = await adminClient
    .from("subscription_plans")
    .select("slug,name,price_monthly,price_yearly,is_active,description,features,limits,available_billing_modes")
    .eq("is_active", true)
    .order("price_monthly", { ascending: true });

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return (data ?? []).map((plan) => ({
    slug: plan.slug,
    name: plan.name,
    priceMonthly: plan.price_monthly,
    priceYearly: plan.price_yearly,
    description: plan.description,
    features: plan.features,
    limits: plan.limits,
    availableBillingModes: plan.available_billing_modes,
  }));
}

