<script setup lang="ts">
import { defineAsyncComponent, computed } from "vue"

import type { Database } from "@/types/database.types"
import LandingHero from "../components/landing/LandingHero.vue"
import LandingNavbar from "../components/landing/LandingNavbar.vue"
import { useLanding } from "../composables/useLanding"
import type { LandingPricingPlan } from "../composables/useLanding"

type SubscriptionPlanRow = Pick<
  Database["public"]["Tables"]["subscription_plans"]["Row"],
  | "slug"
  | "name"
  | "price_monthly"
  | "price_yearly"
  | "is_active"
  | "description"
  | "features"
  | "limits"
  | "available_billing_modes"
>

definePageMeta({
  layout: false,
})

const LandingFeatures = defineAsyncComponent(() => import("../components/landing/LandingFeatures.vue"))
const LandingHowItWorks = defineAsyncComponent(() => import("../components/landing/LandingHowItWorks.vue"))
const LandingPricing = defineAsyncComponent(() => import("../components/landing/LandingPricing.vue"))
const LandingTestimonials = defineAsyncComponent(() => import("../components/landing/LandingTestimonials.vue"))
const LandingFAQ = defineAsyncComponent(() => import("../components/landing/LandingFAQ.vue"))
const LandingFinalCTA = defineAsyncComponent(() => import("../components/landing/LandingFinalCTA.vue"))
const LandingFooter = defineAsyncComponent(() => import("../components/landing/LandingFooter.vue"))

const {
  navigation,
  trustBadges,
  features,
  steps,
  pricingPlans: defaultPricingPlans,
  testimonials,
  faqItems,
  footerColumns,
} = useLanding()

const supabase = useSupabaseClient<Database>()

const { data: dbPlans } = await useAsyncData<SubscriptionPlanRow[]>(
  "landing-subscription-plans",
  async () => {
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("slug,name,price_monthly,price_yearly,is_active,description,features,limits,available_billing_modes")
      .eq("is_active", true)
      .order("price_monthly", { ascending: true })

    if (error) {
      throw error
    }

    return (data ?? []) as SubscriptionPlanRow[]
  },
)

const pricingPlans = computed<LandingPricingPlan[]>(() => {
  if (!dbPlans.value || dbPlans.value.length === 0) {
    return defaultPricingPlans
  }

  const parseFeatures = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is string => typeof item === "string")
  }

  const parseLimits = (value: unknown): Record<string, number> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => [k, v as number] as const)
    return Object.fromEntries(entries)
  }

  const parseBillingModes = (
    value: unknown,
    fallback: LandingPricingPlan,
  ): LandingPricingPlan["billingModes"] => {
    const defaults = fallback.billingModes
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return defaults
    }

    const getMode = (mode: "monthly" | "quarterly" | "annual") => {
      const direct = (value as Record<string, unknown>)[mode]
      if (direct && typeof direct === "object" && !Array.isArray(direct)) {
        return direct as Record<string, unknown>
      }

      for (const item of Object.values(value as Record<string, unknown>)) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue
        const obj = item as Record<string, unknown>
        if (String(obj.label ?? "").toLowerCase() === mode) {
          return obj
        }
      }

      return null
    }

    const pick = (mode: "monthly" | "quarterly" | "annual") => {
      const obj = getMode(mode)
      if (!obj) return defaults[mode]
      const enabled = typeof obj.enabled === "boolean" ? obj.enabled : defaults[mode].enabled
      const discountPercent = typeof obj.discount_percent === "number"
        ? obj.discount_percent
        : typeof obj.discountPercent === "number"
          ? obj.discountPercent
          : defaults[mode].discountPercent
      const label = typeof obj.label === "string" ? obj.label : defaults[mode].label
      return { label, enabled, discountPercent }
    }

    return {
      monthly: pick("monthly"),
      quarterly: pick("quarterly"),
      annual: pick("annual"),
    }
  }

  const buildFeatureList = (plan: SubscriptionPlanRow, fallback: LandingPricingPlan): string[] => {
    const dbFeatures = parseFeatures(plan.features)
    const limits = parseLimits(plan.limits)
    if (dbFeatures.length === 0 && Object.keys(limits).length === 0) {
      return fallback.features
    }

    const users = limits.users
    const branches = limits.branches
    const monthlySales = limits.monthly_sales_per_branch
    const merged: string[] = []
    if (users) merged.push(`${users} usuarios`)
    if (branches) merged.push(`${branches} sucursales`)
    if (monthlySales) merged.push(`${monthlySales} ventas por sucursal`)
    for (const feature of dbFeatures) {
      merged.push(feature.replaceAll("_", " "))
    }
    return merged.length > 0 ? merged : fallback.features
  }

  return dbPlans.value.map((plan) => {
    const fallback = defaultPricingPlans.find((item) => item.id === plan.slug)
      ?? defaultPricingPlans.find((item) => item.id === "enterprise")!
    const billingModes = parseBillingModes(plan.available_billing_modes, fallback)

    const monthlyPrice = plan.price_monthly
    const quarterlyPrice = Math.round(monthlyPrice * 3 * (1 - (billingModes.quarterly.discountPercent / 100)))
    const yearlyPrice = Math.round(monthlyPrice * 12 * (1 - (billingModes.annual.discountPercent / 100)))

    return {
      id: plan.slug,
      name: plan.name,
      monthlyPrice,
      quarterlyPrice,
      yearlyPrice: plan.price_yearly > 0 ? plan.price_yearly : yearlyPrice,
      description: (plan.description && plan.description.trim().length > 0) ? plan.description : fallback.description,
      highlighted: fallback.highlighted,
      badge: fallback.badge,
      features: buildFeatureList(plan, fallback),
      billingModes,
    }
  })
})

const isScrolled = ref(false)

/**
 * Mantiene el header en modo elevado una vez que el usuario supera el fold.
 */
const handleScroll = () => {
  if (!import.meta.client) {
    return
  }

  isScrolled.value = window.scrollY > 28
}

onMounted(() => {
  handleScroll()
  window.addEventListener("scroll", handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll)
})

useSeoMeta({
  title: "NexusPOS - Gestiona productos, servicios y citas en una sola plataforma",
  description: "SaaS multi-sucursal para salones, tiendas y negocios hibridos. Agenda inteligente, POS hibrido, inventario y reportes en tiempo real.",
  ogTitle: "NexusPOS - Tu negocio, simplificado",
  ogDescription: "Gestiona todo tu negocio en una sola plataforma. Prueba gratis por 14 dias.",
  ogImage: "/og-image.jpg",
  twitterCard: "summary_large_image",
})

useHead({
  script: [
    {
      key: "ld-json-organization",
      type: "application/ld+json",
      textContent: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "NexusPOS",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: pricingPlans.value.map((plan) => ({
          "@type": "Offer",
          name: plan.name,
          price: String(plan.monthlyPrice),
          priceCurrency: "USD",
        })),
      }),
    },
    {
      key: "analytics-placeholder",
      textContent: "window.__NEXUS_ANALYTICS__ = window.__NEXUS_ANALYTICS__ || { google: false, plausible: false };",
    },
  ],
})
</script>

<template>
  <div class="landing-shell min-h-screen text-slate-900 transition-colors duration-300 dark:text-slate-100">
    <LandingNavbar :is-scrolled="isScrolled" :navigation="navigation" />

    <main>
      <LandingHero :trust-badges="trustBadges" />
      <LandingFeatures :items="features" />
      <LandingHowItWorks :items="steps" />
      <LandingPricing :plans="pricingPlans" />
      <LandingTestimonials :items="testimonials" />
      <LandingFAQ :items="faqItems" />
      <LandingFinalCTA />
    </main>

    <LandingFooter :columns="footerColumns" />
  </div>
</template>
