<script setup lang="ts">
import type { SettingsSubscription, UpdateBillingDataPayload } from "@/composables/useSettings";
import type { OrganizationCapabilities } from "@/types/subscription";

interface Props {
  subscription: SettingsSubscription | null;
  capabilities: OrganizationCapabilities | null;
  loading: boolean;
  mutationLoading: boolean;
  error: string | null;
  historyEntries: any[];
  historyLoading: boolean;
}

interface Emits {
  (e: "update-billing", payload: UpdateBillingDataPayload): void;
  (e: "change-plan"): void;
  (e: "cancel"): void;
  (e: "view-history"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const billingForm = reactive({
  invoice_name: "",
  doc_type: "nit" as "nit" | "ci" | "pasaporte" | "cedula",
  doc_number: "",
});

const billingOriginal = reactive({
  invoice_name: "",
  doc_type: "nit" as "nit" | "ci" | "pasaporte" | "cedula",
  doc_number: "",
});

const billingSaved = ref(false);
const billingErrors = ref<Record<string, string>>({});

const docTypeOptions = [
  { value: "nit" as const, label: "NIT" },
  { value: "ci" as const, label: "C.I." },
  { value: "pasaporte" as const, label: "Pasaporte" },
  { value: "cedula" as const, label: "Cedula de identidad" },
];

const docFormatHints: Record<string, string> = {
  nit: "10 digitos numericos (ej: 1234567890)",
  ci: "5-8 digitos, opcionalmente seguidos de 1-2 letras (ej: 12345678)",
  pasaporte: "6-9 caracteres alfanumericos (ej: AB123456)",
  cedula: "5-8 digitos (ej: 12345678)",
};

const docPatterns: Record<string, RegExp> = {
  nit: /^\d{10}$/,
  ci: /^\d{5,8}[A-Za-z]{0,2}$/,
  pasaporte: /^[A-Za-z0-9]{6,9}$/,
  cedula: /^\d{5,8}$/,
};

watch(
  () => props.subscription,
  (sub) => {
    if (!sub) return;
    billingForm.invoice_name = sub.invoice_name ?? "";
    billingForm.doc_type = sub.doc_type ?? "nit";
    billingForm.doc_number = sub.doc_number ?? "";

    billingOriginal.invoice_name = sub.invoice_name ?? "";
    billingOriginal.doc_type = sub.doc_type ?? "nit";
    billingOriginal.doc_number = sub.doc_number ?? "";
  },
  { immediate: true },
);

watch(
  () => billingForm.doc_type,
  () => {
    billingErrors.value.doc_number = "";
  },
);

const isBillingDirty = computed(() =>
  billingForm.invoice_name !== billingOriginal.invoice_name ||
  billingForm.doc_type !== billingOriginal.doc_type ||
  billingForm.doc_number !== billingOriginal.doc_number,
);

const statusLabel = computed(() => {
  const s = props.subscription?.status;
  if (s === "trial") return "Trial";
  if (s === "active") return "Activo";
  return s ?? "Desconocido";
});

const statusColor = computed(() => {
  const s = props.subscription?.status;
  if (s === "trial") return "amber";
  if (s === "active") return "green";
  return "neutral";
});

const branchPercent = computed(() => {
  const max = props.capabilities?.maxBranches ?? 1;
  const current = props.capabilities?.currentBranchesCount ?? 0;
  return Math.min((current / max) * 100, 100);
});

const userPercent = computed(() => {
  const max = props.capabilities?.maxUsers ?? 1;
  const current = props.capabilities?.currentUsersCount ?? 0;
  return Math.min((current / max) * 100, 100);
});

const periodEndFormatted = computed(() => {
  if (!props.subscription?.current_period_end) return "No disponible";
  return new Date(props.subscription.current_period_end).toLocaleDateString("es-BO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

const periodStartFormatted = computed(() => {
  if (!props.subscription?.current_period_start) return "No disponible";
  return new Date(props.subscription.current_period_start).toLocaleDateString("es-BO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

const trialEndFormatted = computed(() => {
  if (!props.capabilities?.trialEndsAt) return null;
  return new Date(props.capabilities.trialEndsAt).toLocaleDateString("es-BO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

const handleBillingSubmit = () => {
  billingErrors.value = {};
  const trimmed = billingForm.doc_number.trim();
  if (trimmed) {
    const pattern = docPatterns[billingForm.doc_type];
    if (pattern && !pattern.test(trimmed)) {
      billingErrors.value.doc_number = `Formato invalido. ${docFormatHints[billingForm.doc_type]}`;
    }
  }
  if (Object.keys(billingErrors.value).length > 0) return;

  emit("update-billing", {
    invoice_name: billingForm.invoice_name || undefined,
    doc_type: billingForm.doc_type,
    doc_number: trimmed || undefined,
  });
  billingOriginal.invoice_name = billingForm.invoice_name;
  billingOriginal.doc_type = billingForm.doc_type;
  billingOriginal.doc_number = trimmed;
  billingSaved.value = true;
  setTimeout(() => { billingSaved.value = false; }, 3000);
};

const handleBillingReset = () => {
  billingForm.invoice_name = billingOriginal.invoice_name;
  billingForm.doc_type = billingOriginal.doc_type;
  billingForm.doc_number = billingOriginal.doc_number;
  billingErrors.value = {};
};
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center py-8">
    <UIcon name="i-lucide-loader" class="h-8 w-8 animate-spin text-primary-500" />
  </div>

  <template v-else-if="subscription">
    <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Datos de Subscripcion</h3>

    <div class="mt-4 grid gap-6 lg:grid-cols-3">
      <!-- LEFT: Plan info + card + Billing data -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Plan Info Card -->
        <UCard class="rounded-3xl">
          <template #header>
            <h3 class="text-base font-semibold text-slate-900 dark:text-white">Informacion del plan</h3>
          </template>

          <div class="space-y-4">
            <!-- Dates -->
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                <p class="text-xs text-slate-500 dark:text-slate-400">Fecha de registro</p>
                <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">{{ periodStartFormatted }}</p>
              </div>
              <div class="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                <p class="text-xs text-slate-500 dark:text-slate-400">Vencimiento del plan</p>
                <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">{{ periodEndFormatted }}</p>
              </div>
            </div>

            <!-- Plan card -->
            <div class="rounded-2xl bg-gradient-to-br from-primary-500 to-sky-600 p-6 text-white dark:from-primary-600 dark:to-sky-700">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs uppercase tracking-[0.2em] text-white/70">Plan actual</p>
                  <p class="mt-1 text-3xl font-bold">{{ capabilities?.planName ?? "Emprende" }}</p>
                </div>
                <UBadge :color="statusColor" variant="solid" class="bg-white text-primary-700">
                  {{ statusLabel }}
                </UBadge>
              </div>

              <div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p class="text-xs text-white/60">Sucursales</p>
                  <p class="text-xl font-semibold">{{ capabilities?.currentBranchesCount ?? 0 }} / {{ capabilities?.maxBranches ?? 1 }}</p>
                  <div class="mt-1 h-1.5 rounded-full bg-white/20">
                    <div class="h-full rounded-full bg-white" :style="{ width: branchPercent + '%' }" />
                  </div>
                </div>
                <div>
                  <p class="text-xs text-white/60">Usuarios</p>
                  <p class="text-xl font-semibold">{{ capabilities?.currentUsersCount ?? 0 }} / {{ capabilities?.maxUsers ?? 1 }}</p>
                  <div class="mt-1 h-1.5 rounded-full bg-white/20">
                    <div class="h-full rounded-full bg-white" :style="{ width: userPercent + '%' }" />
                  </div>
                </div>
                <div>
                  <p class="text-xs text-white/60">Periodo</p>
                  <p class="text-sm font-medium">{{ periodEndFormatted }}</p>
                </div>
                <div v-if="capabilities?.isTrial && trialEndFormatted">
                  <p class="text-xs text-white/60">Trial hasta</p>
                  <p class="text-sm font-semibold text-amber-200">{{ trialEndFormatted }}</p>
                </div>
              </div>

              <div class="mt-5 flex gap-3">
                <UButton
                  color="white"
                  variant="solid"
                  size="sm"
                  icon="i-lucide-arrow-up-down"
                  :disabled="mutationLoading"
                  @click="emit('change-plan')"
                >
                  Cambiar plan
                </UButton>
                <UButton
                  color="white"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-x-circle"
                  :disabled="mutationLoading || !!subscription?.cancel_at_period_end"
                  @click="emit('cancel')"
                >
                  Cancelar subscripcion
                </UButton>
              </div>

              <div v-if="subscription?.cancel_at_period_end" class="mt-3 rounded-lg bg-white/10 p-3">
                <p class="text-xs text-white/80">
                  Cancelacion programada. Acceso hasta el fin del periodo.
                </p>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Billing Data CRUD -->
        <UCard class="rounded-3xl">
          <template #header>
            <div>
              <h3 class="text-base font-semibold text-slate-900 dark:text-white">Datos de facturacion</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">Informacion que aparece en tus facturas.</p>
            </div>
          </template>
          <div class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Nombre para factura">
                <UInput v-model="billingForm.invoice_name" placeholder="Empresa SRL" />
              </UFormField>

              <UFormField label="Tipo de documento">
                <USelect v-model="billingForm.doc_type" :options="docTypeOptions" />
              </UFormField>

              <UFormField label="Nro de documento" :error="billingErrors.doc_number" :hint="docFormatHints[billingForm.doc_type]">
                <UInput v-model="billingForm.doc_number" placeholder="1234567890" />
              </UFormField>
            </div>

            <div v-if="billingSaved" class="rounded-lg border border-green-200 bg-green-50 p-2 dark:border-green-800 dark:bg-green-950/30">
              <p class="text-xs text-green-700 dark:text-green-300">Datos guardados.</p>
            </div>

            <div class="flex items-center justify-end gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
              <UButton
                type="button"
                variant="ghost"
                color="neutral"
                size="sm"
                :disabled="!isBillingDirty || mutationLoading"
                @click="handleBillingReset"
              >
                Descartar
              </UButton>
              <UButton
                color="primary"
                size="sm"
                :loading="mutationLoading"
                :disabled="!isBillingDirty || mutationLoading"
                @click="handleBillingSubmit"
              >
                Guardar
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <!-- RIGHT: Mini History -->
      <div>
        <UCard class="rounded-3xl">
          <template #header>
            <h3 class="text-base font-semibold text-slate-900 dark:text-white">Ultimas transacciones</h3>
          </template>
          <SettingsTablesMiniBillingHistory
            :entries="historyEntries"
            :loading="historyLoading"
            @view-all="emit('view-history')"
          />
        </UCard>
      </div>
    </div>
  </template>

  <template v-else>
    <UiEmptyModuleState
      title="Sin suscripcion"
      description="No se encontro una suscripcion activa para esta organizacion."
      icon="i-lucide-credit-card"
    />
  </template>
</template>
