<script setup lang="ts">
import type { OrganizationDraft } from "@/types/registration";
import type { SubscriptionPlanSlug } from "@/types/subscription";
import LogoUpload from "./LogoUpload.vue";
import {
  PLAN_PRICING,
  ORGANIZATION_SCHEMA,
  getCurrencyOptionsForCountry,
  getTimezoneOptionsForCountry,
  COUNTRIES,
  getPlanBillingAmount,
} from "@/utils/onboarding";

type BusinessType = OrganizationDraft["businessTypes"][number];

const props = defineProps<{
  modelValue: OrganizationDraft;
  loading?: boolean;
  submittingTrial?: boolean;
  error?: string | null;
  logoError?: string | null;
  geoCountry?: string;
  geoCurrency?: string;
  geoTimezone?: string;
  geoLoading?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: OrganizationDraft];
  "logo-selected": [file: File];
  "clear-logo": [];
  "save-later": [];
  submit: [];
}>();

const state = reactive<OrganizationDraft>({ ...props.modelValue });
const syncingFromProps = ref(false);

const BUSINESS_TYPE_OPTIONS = [
  { value: "product", label: "Productos", icon: "i-lucide-package", description: "Vendo productos" },
  { value: "service", label: "Servicios", icon: "i-lucide-concierge-bell", description: "Ofrezco servicios" },
  { value: "lodging", label: "Alojamiento", icon: "i-lucide-bed-double", description: "Administro un hostal/hotel" },
] as const;

const areDraftsEqual = (a: OrganizationDraft, b: OrganizationDraft) =>
  a.organizationName === b.organizationName &&
  a.businessTypes.length === b.businessTypes.length &&
  a.businessTypes.every((v, i) => v === b.businessTypes[i]) &&
  a.selectedPlan === b.selectedPlan &&
  a.billingMode === b.billingMode &&
  a.activationMode === b.activationMode &&
  a.country === b.country &&
  a.currency === b.currency &&
  a.timezone === b.timezone &&
  a.logoPreviewUrl === b.logoPreviewUrl;

watch(() => props.modelValue, (v) => {
  syncingFromProps.value = true;
  Object.assign(state, v);
  queueMicrotask(() => { syncingFromProps.value = false; });
}, { deep: true });

watch(state, (v) => {
  if (syncingFromProps.value) return;
  const next = { ...v };
  if (areDraftsEqual(next, props.modelValue)) return;
  emit("update:modelValue", next);
}, { deep: true });

watch(() => [props.geoCountry, props.geoLoading], ([newCountry, loading]) => {
  if (newCountry && typeof newCountry === "string" && !loading && !state.country) {
    state.country = newCountry;
    state.currency = props.geoCurrency || "USD";
    state.timezone = props.geoTimezone || "UTC";
  }
}, { immediate: true });

const plan = computed(() => PLAN_PRICING.find(p => p.slug === state.selectedPlan));
const amount = computed(() => {
  const p = plan.value;
  if (!p) return 20;
  return getPlanBillingAmount(p.slug, state.billingMode);
});

const toggleBusinessType = (type: BusinessType) => {
  const idx = state.businessTypes.indexOf(type);
  if (idx >= 0) {
    if (state.businessTypes.length > 1) {
      state.businessTypes.splice(idx, 1);
    }
  } else {
    const plan = PLAN_PRICING.find(p => p.slug === state.selectedPlan);
    const max = plan?.slug === "emprende" ? 1 : 2;
    if (state.businessTypes.length < max) {
      state.businessTypes.push(type);
    }
  }
};

const isBusinessTypeChecked = (type: BusinessType) => state.businessTypes.includes(type);

const isBusinessTypeDisabled = (type: BusinessType) => {
  if (state.businessTypes.includes(type)) return false;
  const plan = PLAN_PRICING.find(p => p.slug === state.selectedPlan);
  const max = plan?.slug === "emprende" ? 1 : 2;
  return state.businessTypes.length >= max;
};

watch(
  () => state.selectedPlan,
  () => {
    if (state.selectedPlan === "emprende" && state.businessTypes.length > 1) {
      state.businessTypes = [state.businessTypes[0] ?? "product"];
    }
  },
);

const currencyOptions = computed(() => getCurrencyOptionsForCountry(state.country));
const timezoneOptions = computed(() => getTimezoneOptionsForCountry(state.country));

const onLogoSelected = (file: File) => { emit("logo-selected", file); };
</script>

<template>
  <UCard class="admin-shell-panel relative overflow-hidden rounded-[1.75rem]">
    <div
      v-if="submittingTrial"
      class="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/55 px-6 backdrop-blur-[2px]"
    >
      <div class="w-full max-w-md rounded-[1.5rem] border border-white/15 bg-slate-950/90 p-6 text-center text-white shadow-2xl">
        <UIcon name="i-lucide-loader-circle" class="mx-auto mb-4 h-10 w-10 animate-spin text-primary-300" />
        <p class="text-lg font-semibold">Activando tu periodo de prueba</p>
        <p class="mt-2 text-sm leading-6 text-slate-200">
          Estamos creando tu empresa, configurando el plan y preparando tu acceso al dashboard.
        </p>
      </div>
    </div>
    <template #header>
      <div class="space-y-1">
        <h2 class="text-2xl font-semibold text-slate-950 dark:text-white">Configura tu empresa</h2>
        <p class="text-sm text-slate-600 dark:text-slate-300">Plan, tipos de negocio y datos basicos.</p>
      </div>
    </template>

    <div class="space-y-5">
      <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-triangle-alert" :title="error" />

      <UForm :schema="ORGANIZATION_SCHEMA" :state="state" :validate-on="['blur']" class="space-y-6"
        @submit="emit('submit')">

        <!-- Organization Name -->
        <UFormField label="Nombre de la empresa" name="organizationName" class="md:col-span-3">
          <UInput v-model="state.organizationName" size="lg" icon="i-lucide-building-2" autofocus
            :ui="{ base: 'min-h-11 text-base' }" class="w-full"/>
        </UFormField>

        <!-- Country + Currency + Timezone -->
        <div class="grid gap-4 md:grid-cols-2">
          <UFormField label="Pais" name="country">
            <USelectMenu v-model="state.country" :items="COUNTRIES" value-key="code" label-key="label" searchable
              size="lg" :ui="{ base: 'min-h-11 text-base' }" class="md:w-full"/>
          </UFormField>
          <UFormField label="Moneda" name="currency">
            <USelectMenu v-model="state.currency" :items="currencyOptions" value-key="code" label-key="label" size="lg"
              :ui="{ base: 'min-h-11 text-base' }"  class="md:w-full"/>
          </UFormField>
          <UFormField label="Zona horaria" name="timezone">
            <USelectMenu v-model="state.timezone" :items="timezoneOptions" value-key="value" label-key="label" size="lg"
              :ui="{ base: 'min-h-11 text-base' }" class="md:w-full"/>
          </UFormField>
        </div>

        <!-- Logo (optional) -->
        <LogoUpload :preview-url="state.logoPreviewUrl" :file-name="state.logoFileName" :error="logoError"
          @select="onLogoSelected" @clear="emit('clear-logo')" />
        <!-- Plan + Billing Mode -->
        <div class="space-y-3">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Plan y facturacion</p>
          <div class="grid gap-3 sm:grid-cols-3">
            <button v-for="p in PLAN_PRICING" :key="p.slug" type="button"
              class="relative rounded-2xl border-2 p-4 text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-300"
              :class="state.selectedPlan === p.slug ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200 dark:border-primary-400 dark:bg-primary-950/40 dark:ring-primary-700' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60'"
              @click="state.selectedPlan = p.slug as SubscriptionPlanSlug">
              <div class="block items-center">
                <p class="text-sm font-semibold text-slate-950 dark:text-white">{{ p.name }}</p>
                <p class="text-lg font-bold text-primary-600 dark:text-primary-400">${{ p.priceMonthly }}<span
                    class="text-xs font-normal text-slate-500">/mes</span></p>
              </div>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ p.description }}</p>
              <p v-if="p.businessOnly" class="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                Solo un tipo de negocio.
              </p>
            </button>
          </div>
        <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 text-sm">
              <input v-model="state.billingMode" type="radio" value="monthly" class="accent-primary-500" />
              Mensual <UBadge color="neutral" variant="soft" size="xs">10% off</UBadge>
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input v-model="state.billingMode" type="radio" value="quarterly" class="accent-primary-500" />
              Trimestral <UBadge color="success" variant="soft" size="xs">15% off</UBadge>
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input v-model="state.billingMode" type="radio" value="annual" class="accent-primary-500" />
              Anual <UBadge color="success" variant="soft" size="xs">20% off</UBadge>
            </label>
            <span class="ml-auto text-sm font-semibold text-primary-600 dark:text-primary-400">Total: ${{ amount
              }}</span>
          </div>
        </div>

        <div class="space-y-3">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Activacion</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <button type="button"
              class="rounded-2xl border-2 p-4 text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-300"
              :class="state.activationMode === 'trial'
                ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200 dark:border-primary-400 dark:bg-primary-950/40 dark:ring-primary-700'
                : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60'"
              @click="state.activationMode = 'trial'">
              <p class="text-sm font-semibold text-slate-950 dark:text-white">Periodo de prueba</p>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">31 dias de trial. Disponible una sola vez por usuario.</p>
            </button>
            <button type="button"
              class="rounded-2xl border-2 p-4 text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-300"
              :class="state.activationMode === 'paid'
                ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200 dark:border-primary-400 dark:bg-primary-950/40 dark:ring-primary-700'
                : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60'"
              @click="state.activationMode = 'paid'">
              <p class="text-sm font-semibold text-slate-950 dark:text-white">Pagar ahora</p>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Continua al flujo de pago del plan seleccionado.</p>
            </button>
          </div>
        </div>

        <!-- Business Types (checkboxes) -->
        <div class="space-y-3">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Tipos de negocio</p>
          <div class="grid gap-3 sm:grid-cols-3">
            <label v-for="opt in BUSINESS_TYPE_OPTIONS" :key="opt.value"
              class="relative rounded-2xl border-2 p-4 text-center transition-all cursor-pointer focus-within:ring-2 focus-within:ring-primary-300"
              :class="[
                isBusinessTypeChecked(opt.value)
                  ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200 dark:border-primary-400 dark:bg-primary-950/40 dark:ring-primary-700'
                  : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60',
                isBusinessTypeDisabled(opt.value)
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:shadow-md',
              ]">
              <input type="checkbox" :value="opt.value" :checked="isBusinessTypeChecked(opt.value)"
                :disabled="isBusinessTypeDisabled(opt.value)"
                class="absolute opacity-0 w-0 h-0"
                @change="toggleBusinessType(opt.value)" />
              <UIcon :name="opt.icon" class="mx-auto mb-2 h-8 w-8 text-primary-600 dark:text-primary-400" />
              <p class="text-sm font-semibold text-slate-950 dark:text-white">{{ opt.label }}</p>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ opt.description }}</p>
            </label>
          </div>
          <p v-if="state.selectedPlan === 'emprende'" class="text-xs text-amber-600 dark:text-amber-400">
            El plan Emprende solo permite un tipo de negocio. Para combinar, elige Crecimiento o Enterprise.
          </p>
        </div>

        <!-- Actions -->
        <div class="flex flex-col gap-3 sm:flex-row">
          <UButton color="neutral" variant="soft" class="min-h-11 sm:flex-1" @click="emit('save-later')">
            Guardar y continuar despues
          </UButton>
          <UButton type="submit" :loading="loading" class="auth-submit-button min-h-11 sm:flex-1">
            {{ loading ? (state.activationMode === "trial" ? "Activando prueba..." : "Creando empresa...") : state.activationMode === "trial" ? "Activar prueba" : "Continuar al pago" }}
          </UButton>
        </div>
      </UForm>
    </div>
  </UCard>
</template>
