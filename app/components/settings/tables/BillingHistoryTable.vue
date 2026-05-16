<script setup lang="ts">
import type { BillingLedgerEntry } from "@/composables/useBilling";

interface Props {
  entries: BillingLedgerEntry[];
  loading: boolean;
  total: number;
}

interface Emits {
  (e: "load-more"): void;
}

const props = defineProps<Props>();
defineEmits<Emits>();

const eventTypeLabels: Record<string, { label: string; color: string }> = {
  plan_change: { label: "Cambio de plan", color: "blue" },
  payment: { label: "Pago", color: "green" },
  cancellation: { label: "Cancelacion", color: "red" },
  reactivation: { label: "Reactivacion", color: "purple" },
  trial_start: { label: "Inicio trial", color: "amber" },
  trial_end: { label: "Fin trial", color: "orange" },
  proration_credit: { label: "Credito proration", color: "teal" },
  proration_charge: { label: "Cargo proration", color: "rose" },
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("es-BO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatAmount = (amount: number | null, currency: string) => {
  if (amount === null) return "—";
  const sign = amount < 0 ? "-" : "";
  return `${sign}${currency} ${Math.abs(amount).toFixed(2)}`;
};

const hasMore = computed(() => {
  return props.entries.length < props.total;
});
</script>

<template>
  <div>
    <div v-if="loading && props.entries.length === 0" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader" class="h-8 w-8 animate-spin text-primary-500" />
    </div>

    <template v-else-if="props.entries.length > 0">
      <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Fecha</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Evento</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Plan</th>
              <th class="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Monto</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400 hidden md:table-cell">Descripcion</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="entry in props.entries" :key="entry.id" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
              <td class="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">
                {{ formatDate(entry.created_at) }}
              </td>
              <td class="px-4 py-3">
                <UBadge
                  :color="eventTypeLabels[entry.event_type]?.color ?? 'neutral'"
                  variant="soft"
                  size="sm"
                >
                  {{ eventTypeLabels[entry.event_type]?.label ?? entry.event_type }}
                </UBadge>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-300">
                {{ entry.plan?.name ?? "—" }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                {{ formatAmount(entry.amount, entry.currency) }}
              </td>
              <td class="max-w-xs truncate px-4 py-3 text-slate-500 dark:text-slate-400 hidden md:table-cell">
                {{ entry.description ?? "—" }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="hasMore" class="mt-4 flex justify-center">
        <UButton variant="ghost" color="neutral" :loading="loading" @click="$emit('load-more')">
          Cargar mas ({{ props.total - props.entries.length }} restantes)
        </UButton>
      </div>
    </template>

    <UiEmptyModuleState
      v-else
      title="Sin historial"
      description="Aun no hay transacciones registradas."
      icon="i-lucide-receipt"
    />
  </div>
</template>
