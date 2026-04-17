<script setup lang="ts">
import { defineAsyncComponent, computed } from "vue"

import type { Database } from "@/types/database.types"
import LandingHero from "../components/landing/LandingHero.vue"
import LandingNavbar from "../components/landing/LandingNavbar.vue"
import { useLanding } from "../composables/useLanding"
import type { LandingPricingPlan } from "../composables/useLanding"

type SubscriptionPlanRow = Pick<
  Database["public"]["Tables"]["subscription_plans"]["Row"],
  "slug" | "name" | "price_monthly" | "price_yearly" | "is_active"
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
      .select("slug,name,price_monthly,price_yearly,is_active")
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

  return dbPlans.value.map((plan) => {
    const fallback = defaultPricingPlans.find((item) => item.id === plan.slug)

    return {
      id: plan.slug,
      name: plan.name,
      monthlyPrice: plan.price_monthly,
      yearlyPrice: plan.price_yearly,
      description: fallback?.description ?? "",
      highlighted: fallback?.highlighted,
      badge: fallback?.badge,
      features: fallback?.features ?? [],
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
