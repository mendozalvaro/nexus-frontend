<script setup lang="ts">
import type { BillingLedgerEntry } from "@/composables/useBilling";

interface Props {
  entries: BillingLedgerEntry[];
  loading: boolean;
}

interface Emits {
  (e: "view-all"): void;
}

defineProps<Props>();
defineEmits<Emits>();

const eventTypeLabels: Record<string, { label: string; color: string }> = {
  plan_change: { label: "Cambio plan", color: "blue" },
  payment: { label: "Pago", color: "green" },
  cancellation: { label: "Cancelacion", color: "red" },
  reactivation: { label: "Reactivacion", color: "purple" },
  trial_start: { label: "Inicio trial", color: "amber" },
  trial_end: { label: "Fin trial", color: "orange" },
  proration_credit: { label: "Credito", color: "teal" },
  proration_charge: { label: "Cargo", color: "rose" },
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("es-BO", {
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
</script>

<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-4">
      <UIcon name="i-lucide-loader" class="h-5 w-5 animate-spin text-primary-500" />
    </div>

    <template v-else-if="entries.length > 0">
      <div class="space-y-2">
        <div v-for="entry in entries" :key="entry.id" class="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800">
          <div class="min-w-0">
            <UBadge
              :color="eventTypeLabels[entry.event_type]?.color ?? 'neutral'"
              variant="soft"
              size="xs"
            >
              {{ eventTypeLabels[entry.event_type]?.label ?? entry.event_type }}
            </UBadge>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{ entry.plan?.name ?? "—" }} · {{ formatDate(entry.created_at) }}
            </p>
          </div>
          <p class="ml-3 whitespace-nowrap text-sm font-mono text-slate-700 dark:text-slate-300">
            {{ formatAmount(entry.amount, entry.currency) }}
          </p>
        </div>
      </div>

      <UButton
        variant="ghost"
        color="neutral"
        size="sm"
        class="mt-3 w-full"
        icon="i-lucide-arrow-right"
        trailing
        @click="$emit('view-all')"
      >
        Ver historial completo
      </UButton>
    </template>

    <div v-else class="rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
      <UIcon name="i-lucide-receipt" class="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Sin transacciones</p>
    </div>
  </div>
</template>
