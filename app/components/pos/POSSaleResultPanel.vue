<script setup lang="ts">
import type { POSProforma, POSSalesOrder } from "@/composables/usePOSSales";

const props = defineProps<{
  order: POSSalesOrder | null;
  proforma: POSProforma | null;
  canCharge: boolean;
  loading?: boolean;
}>();

const emits = defineEmits<{
  charge: [orderId: string];
  printProforma: [proformaId: string];
  clear: [];
}>();

const isSale = computed(() => Boolean(props.order && !props.proforma));
const isProforma = computed(() => Boolean(props.order && props.proforma));
</script>

<template>
  <UCard class="rounded-[1.75rem]">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-950 dark:text-white">
            Resultado actual
          </h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Venta o proforma generada a partir del carrito activo.
          </p>
        </div>
        <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="emits('clear')">
          Limpiar
        </UButton>
      </div>
    </template>

    <UiEmptySearchState
      v-if="!order"
      title="Sin resultado"
      description="Registra una venta o proforma para habilitar acciones posteriores."
      icon="i-lucide-receipt-text"
    />

    <div v-else class="space-y-4">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">OV</p>
          <p class="mt-2 text-xl font-semibold text-slate-950 dark:text-white">#{{ order.sales_order_number }}</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Cliente</p>
          <p class="mt-2 text-base font-semibold text-slate-950 dark:text-white">{{ order.customer_full_name }}</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Estado</p>
          <p class="mt-2 text-base font-semibold text-slate-950 dark:text-white">{{ order.status }}</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Total</p>
          <p class="mt-2 text-xl font-semibold text-slate-950 dark:text-white">Bs {{ Number(order.final_amount).toFixed(2) }}</p>
        </div>
      </div>

      <UAlert
        v-if="isSale"
        color="success"
        variant="soft"
        icon="i-lucide-circle-check-big"
        :title="`Venta registrada correctamente.`"
        :description="canCharge ? 'Puedes continuar con el cobro inmediato desde este panel.' : 'El cobro queda restringido a admin y manager.'"
      />

      <UAlert
        v-if="isProforma && proforma"
        color="primary"
        variant="soft"
        icon="i-lucide-file-text"
        :title="`Proforma #${proforma.proforma_number} emitida.`"
        description="Puedes imprimir la proforma o retomarla luego para cobro."
      />

      <div class="flex flex-wrap gap-3">
        <UButton
          v-if="isSale && canCharge"
          color="primary"
          icon="i-lucide-credit-card"
          :loading="loading"
          @click="emits('charge', order.id)"
        >
          Cobrar ahora
        </UButton>
        <UButton
          v-if="isProforma && proforma"
          color="neutral"
          variant="soft"
          icon="i-lucide-printer"
          :loading="loading"
          @click="emits('printProforma', proforma.id)"
        >
          Imprimir proforma
        </UButton>
      </div>
    </div>
  </UCard>
</template>

