<script setup lang="ts">
import type { LandingPricingPlan } from "../../composables/useLanding"

const props = defineProps<{
  plans: readonly LandingPricingPlan[]
}>()

type BillingMode = "monthly" | "quarterly" | "annual"
type BillingOption = {
  key: BillingMode
  label: string
  discountPercent: number
}

const billingMode = ref<BillingMode>("monthly")
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
    const entry = entries[0]
    if (entry && entry.isIntersecting) {
      isVisible.value = true
      observer?.disconnect()
    }
  }, { threshold: 0.2 })

  observer.observe(sectionRef.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
})

const getDisplayPrice = (plan: LandingPricingPlan) => {
  if (billingMode.value === "quarterly") {
    return plan.quarterlyPrice
  }

  if (billingMode.value === "annual") {
    return plan.yearlyPrice
  }

  return plan.monthlyPrice
}

const BILLING_MODE_LABELS: Record<BillingMode, string> = {
  monthly: "Mensual",
  quarterly: "Trimestral",
  annual: "Anual",
}

const billingOptions = computed<BillingOption[]>(() => {
  const options: BillingOption[] = []
  const order: BillingMode[] = ["monthly", "quarterly", "annual"]
  for (const mode of order) {
    const enabledInAnyPlan = props.plans.some((plan) => plan.billingModes?.[mode]?.enabled === true)
    if (!enabledInAnyPlan) continue
    const maxDiscount = props.plans.reduce((max, plan) => {
      const discount = plan.billingModes?.[mode]?.discountPercent ?? 0
      return Math.max(max, discount)
    }, 0)
    options.push({
      key: mode,
      label: BILLING_MODE_LABELS[mode],
      discountPercent: maxDiscount,
    })
  }
  if (options.length === 0) {
    options.push({ key: "monthly", label: "Mensual", discountPercent: 0 })
  }
  return options
})

watch(billingOptions, (next) => {
  if (!next.some((item) => item.key === billingMode.value)) {
    billingMode.value = next[0]?.key ?? "monthly"
  }
}, { immediate: true })

const currentBillingOption = computed(() =>
  billingOptions.value.find((item) => item.key === billingMode.value)
    ?? { key: "monthly" as const, label: "Mensual", discountPercent: 0 },
)

const getBillingSuffix = (mode: BillingMode) => {
  if (mode === "annual") return "año"
  if (mode === "quarterly") return "trimestre"
  return "mes"
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
            v-for="option in billingOptions"
            :key="option.key"
            type="button"
            class="landing-billing-option admin-focus-ring"
            :class="billingMode === option.key ? 'landing-billing-option-active' : ''"
            @click="billingMode = option.key"
          >
            {{ option.label }}
            <span v-if="option.discountPercent > 0" class="landing-billing-badge">{{ option.discountPercent }}% off</span>
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
              {{ currencyFormatter.format(getDisplayPrice(plan)) }}
            </span>
            <span class="pb-1 text-sm text-slate-500 dark:text-slate-400">
              /{{ getBillingSuffix(billingMode) }}
            </span>
          </div>

          <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {{
              currentBillingOption.discountPercent > 0
                ? `Facturacion ${currentBillingOption.label.toLowerCase()} con ${currentBillingOption.discountPercent}% de descuento.`
                : "Facturacion mensual sin permanencia."
            }}
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
              @click="navigateTo(`/auth/register?plan=${plan.id}&billing=${billingMode}`)"
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
