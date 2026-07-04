<script setup lang="ts">
import type { POSSalesOrder } from "@/composables/usePOSSales";

const props = defineProps<{
  rows: POSSalesOrder[];
  loading?: boolean;
  canEdit?: boolean;
  canPay?: boolean;
  canView?: boolean;
}>();

const emits = defineEmits<{
  view: [id: string];
  edit: [id: string];
  pay: [id: string];
}>();
</script>

<template>
  <UCard class="rounded-[1.75rem]">
    <template #header>
      <div>
        <h2 class="text-lg font-semibold text-slate-950 dark:text-white">Ventas</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Seguimiento operativo de órdenes de venta.</p>
      </div>
    </template>

    <UiEmptySearchState
      v-if="!loading && rows.length === 0"
      title="Sin ventas"
      description="Todavía no hay órdenes de venta registradas para mostrar."
      icon="i-lucide-shopping-basket"
    />

    <div v-else class="space-y-3">
      <div
        v-for="row in rows"
        :key="row.id"
        class="flex flex-col gap-4 rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between"
      >
        <div class="space-y-1">
          <p class="text-base font-semibold text-slate-950 dark:text-white">
            OV #{{ row.sales_order_number }} · {{ row.customer_full_name }}
          </p>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Estado {{ row.status }} · Total Bs {{ Number(row.final_amount).toFixed(2) }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton v-if="canView" size="sm" variant="soft" color="neutral" @click="emits('view', row.id)">Ver</UButton>
          <UButton
            v-if="canEdit"
            size="sm"
            variant="soft"
            color="neutral"
            :disabled="row.status === 'charged' || row.status === 'cancelled'"
            @click="emits('edit', row.id)"
          >
            Editar
          </UButton>
          <UButton
            v-if="canPay"
            size="sm"
            color="primary"
            :disabled="row.status !== 'ready_to_charge'"
            @click="emits('pay', row.id)"
          >
            Pagar
          </UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>

