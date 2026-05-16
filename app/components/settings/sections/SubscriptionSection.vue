<script setup lang="ts">
import type { SettingsSubscription } from "@/composables/useSettings";
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
  (e: "change-plan"): void;
  (e: "cancel"): void;
  (e: "view-history"): void;
  (e: "pay"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const form = reactive({
  invoice_name: "",
  doc_type: "nit",
  doc_number: "",
});

const docTypeOptions = [
  { value: "nit", label: "NIT" },
  { value: "ci", label: "C.I." },
  { value: "pasaporte", label: "Pasaporte" },
  { value: "cedula", label: "Cedula de identidad" },
];

watch(
  () => props.subscription,
  (sub) => {
    if (!sub) return;
    form.invoice_name = (sub as any).invoice_name ?? props.capabilities?.planName ?? "";
    form.doc_type = (sub as any).doc_type ?? "nit";
    form.doc_number = (sub as any).doc_number ?? "";
  },
  { immediate: true },
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

const trialEndFormatted = computed(() => {
  if (!props.capabilities?.trialEndsAt) return null;
  return new Date(props.capabilities.trialEndsAt).toLocaleDateString("es-BO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center py-8">
    <UIcon name="i-lucide-loader" class="h-8 w-8 animate-spin text-primary-500" />
  </div>

  <template v-else-if="subscription">
    <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Datos de Subscripcion</h3>

    <div class="mt-4 grid gap-6 lg:grid-cols-3">
      <!-- LEFT: Sub Data + Plan Card -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Read-only info -->
        <UCard class="rounded-3xl">
          <template #header>
            <h3 class="text-base font-semibold text-slate-900 dark:text-white">Informacion del plan</h3>
          </template>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
              <p class="text-xs text-slate-500 dark:text-slate-400">Fecha de registro</p>
              <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                {{ subscription.current_period_start ? new Date(subscription.current_period_start).toLocaleDateString('es-BO', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No disponible' }}
              </p>
            </div>
            <div class="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
              <p class="text-xs text-slate-500 dark:text-slate-400">Vencimiento del plan</p>
              <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">{{ periodEndFormatted }}</p>
            </div>
          </div>
        </UCard>

        <!-- Editable billing info -->
        <UCard class="rounded-3xl">
          <template #header>
            <h3 class="text-base font-semibold text-slate-900 dark:text-white">Datos de facturacion</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Informacion que aparece en tus facturas.</p>
          </template>
          <div class="grid gap-4 md:grid-cols-3">
            <UFormField label="Nombre para factura">
              <UInput v-model="form.invoice_name" placeholder="Empresa SRL" />
            </UFormField>

            <UFormField label="Tipo de documento">
              <USelect v-model="form.doc_type" :options="docTypeOptions" />
            </UFormField>

            <UFormField label="Nro de documento">
              <UInput v-model="form.doc_number" placeholder="1234567890" />
            </UFormField>
          </div>
        </UCard>

        <!-- Plan Card with actions -->
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

      <!-- RIGHT: Mini History + Pay -->
      <div class="space-y-6">
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

        <UCard class="rounded-3xl">
          <template #header>
            <h3 class="text-base font-semibold text-slate-900 dark:text-white">Pago</h3>
          </template>
          <UButton
            color="primary"
            class="w-full"
            icon="i-lucide-credit-card"
            :disabled="mutationLoading"
            @click="emit('pay')"
          >
            Pagar subscripcion
          </UButton>
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
