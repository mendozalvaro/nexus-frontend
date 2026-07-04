<script setup lang="ts">
import type { AppTheme } from "@/composables/useTheme";
import type { SettingsOrganization } from "@/composables/useSettings";

const props = withDefaults(defineProps<{
  org: SettingsOrganization | null;
  mutationLoading?: boolean;
}>(), {
  mutationLoading: false,
});

const emits = defineEmits<{
  submit: [payload: {
    default_receipt_format: "thermal" | "half_letter";
    lodging_checkout_deadline: string;
    lodging_stay_cutoff_time: string;
    lodging_late_checkout_penalty: number;
  }];
}>();

const { theme, setTheme } = useTheme();
const { hasBusinessType } = useBusinessTypes();

const themeOptions = [
  {
    value: "light" as AppTheme,
    label: "Claro",
    icon: "i-lucide-sun",
    description: "Interfaz luminosa para entornos con buena iluminación.",
  },
  {
    value: "dark" as AppTheme,
    label: "Oscuro",
    icon: "i-lucide-moon",
    description: "Reduce fatiga visual durante turnos largos.",
  },
  {
    value: "system" as AppTheme,
    label: "Sistema",
    icon: "i-lucide-monitor",
    description: "Sigue el tema configurado en el dispositivo.",
  },
];

const receiptOptions = [
  {
    value: "thermal" as const,
    label: "Térmico",
    description: "Ticket compacto para ventas o recepcion.",
    meta: "Impresión rápida",
  },
  {
    value: "half_letter" as const,
    label: "Media carta",
    description: "Formato más amplio para respaldo físico.",
    meta: "Archivo o firma",
  },
];

const receiptFormat = ref<"thermal" | "half_letter">("thermal");
const lodgingCheckoutDeadline = ref("12:00");
const lodgingStayCutoffTime = ref("12:00");
const lodgingLateCheckoutPenalty = ref(0);

const initialState = reactive({
  receiptFormat: "thermal" as "thermal" | "half_letter",
  lodgingCheckoutDeadline: "12:00",
  lodgingStayCutoffTime: "12:00",
  lodgingLateCheckoutPenalty: 0,
});

const saved = ref(false);
const isLodgingBusiness = computed(() => hasBusinessType("lodging"));

watch(
  () => props.org,
  (value) => {
    const nextReceiptFormat = value?.default_receipt_format === "half_letter" ? "half_letter" : "thermal";
    const nextCheckoutDeadline = value?.lodging_checkout_deadline?.slice(0, 5) || "12:00";
    const nextStayCutoffTime = value?.lodging_stay_cutoff_time?.slice(0, 5) || "12:00";
    const nextLateCheckoutPenalty = Number(value?.lodging_late_checkout_penalty ?? 0);

    receiptFormat.value = nextReceiptFormat;
    lodgingCheckoutDeadline.value = nextCheckoutDeadline;
    lodgingStayCutoffTime.value = nextStayCutoffTime;
    lodgingLateCheckoutPenalty.value = nextLateCheckoutPenalty;

    initialState.receiptFormat = nextReceiptFormat;
    initialState.lodgingCheckoutDeadline = nextCheckoutDeadline;
    initialState.lodgingStayCutoffTime = nextStayCutoffTime;
    initialState.lodgingLateCheckoutPenalty = nextLateCheckoutPenalty;
  },
  { immediate: true },
);

const isDirty = computed(() =>
  receiptFormat.value !== initialState.receiptFormat
  || lodgingCheckoutDeadline.value !== initialState.lodgingCheckoutDeadline
  || lodgingStayCutoffTime.value !== initialState.lodgingStayCutoffTime
  || Number(lodgingLateCheckoutPenalty.value ?? 0) !== Number(initialState.lodgingLateCheckoutPenalty ?? 0),
);

const currencyCode = computed(() => props.org?.currency_code ?? "BOB");

const penaltyPreview = computed(() => {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: currencyCode.value,
    minimumFractionDigits: 2,
  }).format(Number(lodgingLateCheckoutPenalty.value ?? 0));
});

const resetForm = () => {
  receiptFormat.value = initialState.receiptFormat;
  lodgingCheckoutDeadline.value = initialState.lodgingCheckoutDeadline;
  lodgingStayCutoffTime.value = initialState.lodgingStayCutoffTime;
  lodgingLateCheckoutPenalty.value = initialState.lodgingLateCheckoutPenalty;
  saved.value = false;
};

const savePreferences = () => {
  emits("submit", {
    default_receipt_format: receiptFormat.value,
    lodging_checkout_deadline: lodgingCheckoutDeadline.value,
    lodging_stay_cutoff_time: lodgingStayCutoffTime.value,
    lodging_late_checkout_penalty: Number(lodgingLateCheckoutPenalty.value ?? 0),
  });
  saved.value = true;
  setTimeout(() => {
    saved.value = false;
  }, 3000);
};
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
      <UCard class="rounded-3xl">
        <template #header>
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Personalización</p>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Apariencia</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Elige el tema que mejor se adapte al ritmo de trabajo.</p>
          </div>
        </template>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            v-for="opt in themeOptions"
            :key="opt.value"
            type="button"
            class="rounded-2xl border p-4 text-left transition-all"
            :class="theme === opt.value
              ? 'border-primary-400 bg-primary-50 text-primary-700 shadow-sm dark:border-primary-500 dark:bg-primary-950/30 dark:text-primary-300'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:border-slate-700'"
            @click="setTheme(opt.value)"
          >
            <div class="flex items-center gap-3">
              <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900">
                <UIcon :name="opt.icon" class="h-5 w-5" />
              </div>
              <div>
                <p class="font-medium">{{ opt.label }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ opt.description }}</p>
              </div>
            </div>
          </button>
        </div>
      </UCard>

      <UCard class="rounded-3xl">
        <template #header>
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Vista previa</p>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Resumen actual</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Referencias cortas para validar la configuración.</p>
          </div>
        </template>

        <div class="space-y-3">
          <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Recibo</p>
            <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">
              {{ receiptFormat === "thermal" ? "Térmico (ticket)" : "Media carta" }}
            </p>
          </div>

          <template v-if="isLodgingBusiness">
            <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Salida límite</p>
              <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">{{ lodgingCheckoutDeadline }}</p>
            </div>

            <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Conteo de estadía</p>
              <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">{{ lodgingStayCutoffTime }}</p>
            </div>

            <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Penalización</p>
              <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">{{ penaltyPreview }}</p>
            </div>
          </template>
        </div>
      </UCard>
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <UCard class="rounded-3xl">
        <template #header>
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Operación</p>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Recibos</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Define el formato de impresión por defecto para caja y recepción.</p>
          </div>
        </template>

        <div class="grid gap-3 sm:grid-cols-2">
          <button
            v-for="option in receiptOptions"
            :key="option.value"
            type="button"
            class="rounded-2xl border p-4 text-left transition-all"
            :class="receiptFormat === option.value
              ? 'border-primary-400 bg-primary-50 shadow-sm dark:border-primary-500 dark:bg-primary-950/30'
              : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-slate-700'"
            @click="receiptFormat = option.value"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-medium text-slate-900 dark:text-white">{{ option.label }}</p>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ option.description }}</p>
              </div>
              <UBadge :color="receiptFormat === option.value ? 'primary' : 'neutral'" variant="soft" size="sm">
                {{ option.meta }}
              </UBadge>
            </div>
          </button>
        </div>
      </UCard>

      <UCard v-if="isLodgingBusiness" class="rounded-3xl">
        <template #header>
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Hospedaje</p>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Parámetros operativos</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Ajusta las reglas usadas en ingresos, salidas y extensión de estadías.</p>
          </div>
        </template>

        <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div class="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div class="mb-4 flex items-start gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <UIcon name="i-lucide-log-out" class="h-4 w-4" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-slate-900 dark:text-white">Hora límite de salida</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Base para recargo.</p>
              </div>
            </div>

            <UFormField label="Salida" hint="Ej: 12:00" class="mt-auto">
              <UInput v-model="lodgingCheckoutDeadline" type="time" :ui="{ base: 'min-h-11 text-base' }" />
            </UFormField>
          </div>

          <div class="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div class="mb-4 flex items-start gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                <UIcon name="i-lucide-moon-star" class="h-4 w-4" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-slate-900 dark:text-white">Hora que cuenta la estadía</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Marca nueva noche.</p>
              </div>
            </div>

            <UFormField label="Conteo" hint="Afecta ingresos y extensiones." class="mt-auto">
              <UInput v-model="lodgingStayCutoffTime" type="time" :ui="{ base: 'min-h-11 text-base' }" />
            </UFormField>
          </div>

          <div class="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div class="mb-4 flex items-start gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <UIcon name="i-lucide-wallet" class="h-4 w-4" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-slate-900 dark:text-white">Penalización por salida tardía</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Cargo sugerido.</p>
              </div>
            </div>

            <UFormField label="Monto" :hint="`${penaltyPreview}`" class="mt-auto">
              <UInputNumber  v-model="lodgingLateCheckoutPenalty" :min="0" class="w-32" :format-options="{ style: 'currency', currency: currencyCode }" orientation="vertical"/>
            </UFormField>
          </div>
        </div>
      </UCard>
    </div>

    <div class="flex flex-wrap items-center justify-end gap-3">
      <div v-if="saved" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
        Preferencias guardadas.
      </div>

      <UButton
        color="neutral"
        variant="ghost"
        :disabled="!isDirty || mutationLoading"
        @click="resetForm"
      >
        Descartar
      </UButton>
      <UButton
        color="primary"
        :loading="mutationLoading"
        :disabled="!isDirty || mutationLoading"
        @click="savePreferences"
      >
        Guardar preferencias
      </UButton>
    </div>
  </div>
</template>
