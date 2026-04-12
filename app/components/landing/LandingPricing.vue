<script setup lang="ts">
import type { LandingPricingPlan } from "../../composables/useLanding"

const props = defineProps<{
  plans: readonly LandingPricingPlan[]
}>()

type BillingMode = "monthly" | "annual"

const billingMode = ref<BillingMode>("monthly")
const annualDiscount = 0.15
const sectionRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)
let observer: IntersectionObserver | null = null

const currencyFormatter = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

onMounted(() => {
  if (!import.meta.client || !sectionRef.value) {
    isVisible.value = true
    return
  }

  observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
    if (entries[0]?.isIntersecting) {
      isVisible.value = true
      observer?.disconnect()
    }
  }, { threshold: 0.2 })

  observer.observe(sectionRef.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
})

const getDisplayPrice = (monthlyPrice: number) => {
  if (billingMode.value === "annual") {
    return Math.round(monthlyPrice * (1 - annualDiscount))
  }

  return monthlyPrice
}
</script>

<template>
  <section
    id="pricing"
    ref="sectionRef"
    class="landing-section"
  >
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="landing-section-heading">
        <p class="landing-section-kicker">Planes y precios</p>
        <h2 class="landing-section-title">
          Planes simples y transparentes
        </h2>
        <p class="landing-section-copy">
          Sin costos ocultos. Cambia de plan cuando tu operacion lo necesite y manten visibilidad completa desde el primer dia.
        </p>
      </div>

      <div class="mt-8 flex justify-center">
        <div class="landing-billing-toggle">
          <button
            type="button"
            class="landing-billing-option admin-focus-ring"
            :class="billingMode === 'monthly' ? 'landing-billing-option-active' : ''"
            @click="billingMode = 'monthly'"
          >
            Mensual
          </button>
          <button
            type="button"
            class="landing-billing-option admin-focus-ring"
            :class="billingMode === 'annual' ? 'landing-billing-option-active' : ''"
            @click="billingMode = 'annual'"
          >
            Anual
            <span class="landing-billing-badge">15% off</span>
          </button>
        </div>
      </div>

      <div class="mt-12 grid gap-6 xl:grid-cols-3">
        <UCard
          v-for="(plan, index) in props.plans"
          :key="plan.id"
          class="landing-pricing-card landing-reveal p-6"
          :class="[
            isVisible ? 'landing-reveal-visible' : '',
            plan.highlighted ? 'landing-pricing-card-featured' : '',
          ]"
          :style="{ transitionDelay: `${index * 90}ms` }"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-lg font-semibold text-slate-950 dark:text-white">
                {{ plan.name }}
              </p>
              <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {{ plan.description }}
              </p>
            </div>
            <UBadge
              v-if="plan.badge"
              color="primary"
              variant="soft"
              class="rounded-full"
            >
              {{ plan.badge }}
            </UBadge>
          </div>

          <div class="mt-8 flex items-end gap-2">
            <span class="text-5xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {{ currencyFormatter.format(getDisplayPrice(plan.monthlyPrice)) }}
            </span>
            <span class="pb-1 text-sm text-slate-500 dark:text-slate-400">
              /mes
            </span>
          </div>

          <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {{ billingMode === "annual" ? "Facturacion anual con descuento incluido." : "Facturacion mensual sin permanencia." }}
          </p>

          <ul class="mt-8 space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <li
              v-for="feature in plan.features"
              :key="feature"
              class="flex gap-3"
            >
              <UIcon name="i-lucide-check-circle-2" class="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
              <span>{{ feature }}</span>
            </li>
          </ul>

          <div class="mt-8 space-y-3">
            <UButton
              color="primary"
              block
              class="rounded-full"
              :variant="plan.highlighted ? 'solid' : 'outline'"
              trailing-icon="i-lucide-arrow-right"
              @click="navigateTo(`/auth/register?plan=${plan.id}`)"
            >
              Elegir {{ plan.name }}
            </UButton>

            <button
              type="button"
              class="landing-inline-button admin-focus-ring"
              @click="navigateTo('#pricing')"
            >
              Comparar planes
            </button>
          </div>
        </UCard>
      </div>
    </div>
  </section>
</template>
