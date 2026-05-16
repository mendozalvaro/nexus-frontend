<script setup lang="ts">
import type { SubscriptionPlanSlug } from "@/types/subscription";
import { PLAN_PRICING, getPlanBillingAmount } from "@/utils/onboarding";

interface Props {
  currentPlanSlug: SubscriptionPlanSlug | null;
  currentBillingMode: "monthly" | "quarterly" | "annual" | null;
  loading: boolean;
}

interface Emits {
  (e: "close"): void;
  (e: "confirm", planSlug: SubscriptionPlanSlug, billingMode: "monthly" | "quarterly" | "annual"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const plans = PLAN_PRICING.map((p) => ({
  ...p,
  slug: p.slug as SubscriptionPlanSlug,
}));

const selectedPlan = ref<SubscriptionPlanSlug | null>(props.currentPlanSlug);
const selectedBillingMode = ref<"monthly" | "quarterly" | "annual">(props.currentBillingMode ?? "monthly");

const billingModeOptions = [
  { value: "monthly" as const, label: "Mensual", discount: 10 },
  { value: "quarterly" as const, label: "Trimestral", discount: 15 },
  { value: "annual" as const, label: "Anual", discount: 20 },
];

const selectedAmount = computed(() => {
  if (!selectedPlan.value) return 0;
  return getPlanBillingAmount(selectedPlan.value, selectedBillingMode.value);
});

const isDowngrade = computed(() => {
  if (!props.currentPlanSlug || !selectedPlan.value) return false;
  const order: SubscriptionPlanSlug[] = ["emprende", "crecimiento", "enterprise"];
  return order.indexOf(selectedPlan.value) < order.indexOf(props.currentPlanSlug);
});

const isSamePlan = computed(() => {
  return selectedPlan.value === props.currentPlanSlug;
});

const handleConfirm = () => {
  if (!selectedPlan.value) return;
  emit("confirm", selectedPlan.value, selectedBillingMode.value);
};
</script>

<template>
  <UModal :open="true" @update:open="emit('close')">
    <template #content>
      <div class="p-6">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Cambiar de plan</h3>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Selecciona el nuevo plan y modo de facturacion. El cambio se aplica inmediatamente.
        </p>

        <div class="mt-4 space-y-4">
          <div>
            <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Plan</label>
            <div class="mt-2 grid gap-3 sm:grid-cols-3">
              <button
                v-for="plan in plans"
                :key="plan.slug"
                type="button"
                class="rounded-xl border p-4 text-left transition"
                :class="selectedPlan === plan.slug
                  ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-500/20 dark:border-primary-500 dark:bg-primary-950/30'
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'"
                @click="selectedPlan = plan.slug"
              >
                <p class="font-semibold text-slate-900 dark:text-white">{{ plan.name }}</p>
                <p class="mt-1 text-2xl font-bold text-primary-600 dark:text-primary-400">
                  ${{ plan.priceMonthly }}<span class="text-sm font-normal text-slate-500">/mes</span>
                </p>
                <ul class="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <li v-for="feature in plan.features.slice(0, 3)" :key="feature">• {{ feature }}</li>
                </ul>
              </button>
            </div>
          </div>

          <div>
            <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Facturacion</label>
            <div class="mt-2 grid gap-2 sm:grid-cols-3">
              <button
                v-for="mode in billingModeOptions"
                :key="mode.value"
                type="button"
                class="rounded-lg border p-3 text-center transition"
                :class="selectedBillingMode === mode.value
                  ? 'border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-950/30'
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'"
                @click="selectedBillingMode = mode.value"
              >
                <p class="text-sm font-medium text-slate-900 dark:text-white">{{ mode.label }}</p>
                <p class="text-xs text-green-600 dark:text-green-400">-{{ mode.discount }}%</p>
              </button>
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Total a cobrar</p>
                <p v-if="isDowngrade" class="text-xs text-amber-600 dark:text-amber-400">
                  Se aplicara un credito por los dias restantes del periodo actual.
                </p>
              </div>
              <p class="text-2xl font-bold text-slate-900 dark:text-white">${{ selectedAmount }}</p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton variant="ghost" color="neutral" @click="emit('close')">
              Cancelar
            </UButton>
            <UButton
              color="primary"
              :loading="loading"
              :disabled="!selectedPlan || isSamePlan"
              @click="handleConfirm"
            >
              Confirmar cambio
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
