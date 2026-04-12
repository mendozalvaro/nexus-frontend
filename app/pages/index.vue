<script setup lang="ts">
import { defineAsyncComponent } from "vue"

import LandingHero from "../components/landing/LandingHero.vue"
import LandingNavbar from "../components/landing/LandingNavbar.vue"
import { useLanding } from "../composables/useLanding"

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
  pricingPlans,
  testimonials,
  faqItems,
  footerColumns,
} = useLanding()

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
        offers: [
          {
            "@type": "Offer",
            name: "Emprende",
            price: "20",
            priceCurrency: "USD",
          },
          {
            "@type": "Offer",
            name: "Crecimiento",
            price: "65",
            priceCurrency: "USD",
          },
          {
            "@type": "Offer",
            name: "Enterprise",
            price: "200",
            priceCurrency: "USD",
          },
        ],
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
