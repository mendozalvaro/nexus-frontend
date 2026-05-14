<script setup lang="ts">
import type { POSTransactionHistoryItem } from "@/composables/usePOS";

defineProps<{
  transactions: POSTransactionHistoryItem[];
  loading: boolean;
}>();

const emit = defineEmits<{
  "view-receipt": [transactionId: string];
}>();
</script>

<template>
  <div class="space-y-4">
    <div v-if="transactions.length === 0" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
      No hay ventas registradas hoy.
    </div>
    <div v-for="tx in transactions" :key="tx.id" class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70">
      <div class="flex items-center justify-between">
        <div>
          <p class="font-semibold text-slate-950 dark:text-white">
            #{{ tx.invoiceNumber }}
          </p>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ tx.customerName }} · {{ tx.paymentMethod }}
          </p>
        </div>
        <div class="text-right">
          <p class="font-semibold text-slate-950 dark:text-white">
            Bs {{ tx.finalAmount.toFixed(2) }}
          </p>
          <UButton size="xs" color="primary" variant="ghost" @click="emit('view-receipt', tx.id)">
            Ver recibo
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
