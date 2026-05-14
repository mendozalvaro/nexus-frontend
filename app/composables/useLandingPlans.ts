import type { Database } from "@/types/database.types";
import type { LandingPricingPlan } from "./useLanding";

type DbPlanRow = Pick<
  Database["public"]["Tables"]["subscription_plans"]["Row"],
  "slug" | "name" | "price_monthly" | "price_yearly" | "description" | "features" | "limits" | "available_billing_modes"
>;

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

export const useLandingPlans = () => {
  const { pricingPlans: defaultPricingPlans } = useLanding();

  const { data: dbPlans } = useAsyncData<PublicPlan[]>(
    "landing-subscription-plans",
    async () => {
      const { plans } = await $fetch<{ plans: PublicPlan[] }>("/api/public/plans");
      return plans;
    },
  );

  const pricingPlans = computed<LandingPricingPlan[]>(() => {
    if (!dbPlans.value || dbPlans.value.length === 0) {
      return defaultPricingPlans;
    }

    const parseFeatures = (value: unknown): string[] => {
      if (!Array.isArray(value)) return [];
      return value.filter((item): item is string => typeof item === "string");
    };

    const parseLimits = (value: unknown): Record<string, number> => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return {};
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => [k, v as number] as const);
      return Object.fromEntries(entries);
    };

    const parseBillingModes = (
      value: unknown,
      fallback: LandingPricingPlan,
    ): LandingPricingPlan["billingModes"] => {
      const defaults = fallback.billingModes;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return defaults;
      }

      const getMode = (mode: "monthly" | "quarterly" | "annual") => {
        const direct = (value as Record<string, unknown>)[mode];
        if (direct && typeof direct === "object" && !Array.isArray(direct)) {
          return direct as Record<string, unknown>;
        }

        for (const item of Object.values(value as Record<string, unknown>)) {
          if (!item || typeof item !== "object" || Array.isArray(item)) continue;
          const obj = item as Record<string, unknown>;
          if (String(obj.label ?? "").toLowerCase() === mode) {
            return obj;
          }
        }

        return null;
      };

      const pick = (mode: "monthly" | "quarterly" | "annual") => {
        const obj = getMode(mode);
        if (!obj) return defaults[mode];
        const enabled = typeof obj.enabled === "boolean" ? obj.enabled : defaults[mode].enabled;
        const discountPercent = typeof obj.discount_percent === "number"
          ? obj.discount_percent
          : typeof obj.discountPercent === "number"
            ? obj.discountPercent
            : defaults[mode].discountPercent;
        const label = typeof obj.label === "string" ? obj.label : defaults[mode].label;
        return { label, enabled, discountPercent };
      };

      return {
        monthly: pick("monthly"),
        quarterly: pick("quarterly"),
        annual: pick("annual"),
      };
    };

    const buildFeatureList = (plan: DbPlanRow, fallback: LandingPricingPlan): string[] => {
      const dbFeatures = parseFeatures(plan.features);
      const limits = parseLimits(plan.limits);
      if (dbFeatures.length === 0 && Object.keys(limits).length === 0) {
        return fallback.features;
      }

      const users = limits.users;
      const branches = limits.branches;
      const monthlySales = limits.monthly_sales_per_branch;
      const merged: string[] = [];
      if (users) merged.push(`${users} usuarios`);
      if (branches) merged.push(`${branches} sucursales`);
      if (monthlySales) merged.push(`${monthlySales} ventas por sucursal`);
      for (const feature of dbFeatures) {
        merged.push(feature.replaceAll("_", " "));
      }
      return merged.length > 0 ? merged : fallback.features;
    };

    return dbPlans.value.map((plan) => {
      const fallback = defaultPricingPlans.find((item) => item.id === plan.slug)
        ?? defaultPricingPlans.find((item) => item.id === "enterprise")!;
      const billingModes = parseBillingModes(plan.availableBillingModes, fallback);

      const monthlyPrice = plan.priceMonthly;
      const quarterlyPrice = Math.round(monthlyPrice * 3 * (1 - (billingModes.quarterly.discountPercent / 100)));
      const yearlyPrice = Math.round(monthlyPrice * 12 * (1 - (billingModes.annual.discountPercent / 100)));

      return {
        id: plan.slug,
        name: plan.name,
        monthlyPrice,
        quarterlyPrice,
        yearlyPrice: plan.priceYearly > 0 ? plan.priceYearly : yearlyPrice,
        description: (plan.description && plan.description.trim().length > 0) ? plan.description : fallback.description,
        highlighted: fallback.highlighted,
        badge: fallback.badge,
        features: buildFeatureList({
          slug: plan.slug,
          name: plan.name,
          price_monthly: plan.priceMonthly,
          price_yearly: plan.priceYearly,
          description: plan.description,
          features: plan.features,
          limits: plan.limits,
          available_billing_modes: plan.availableBillingModes,
        } as unknown as DbPlanRow, fallback),
        billingModes,
      };
    });
  });

  return { pricingPlans };
};
