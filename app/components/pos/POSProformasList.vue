<script setup lang="ts">
import type { POSProforma } from "@/composables/usePOSSales";

const props = defineProps<{
  rows: POSProforma[];
  loading?: boolean;
  canView?: boolean;
}>();

const emits = defineEmits<{
  view: [id: string];
  resume: [id: string];
  print: [id: string];
}>();
</script>

<template>
  <UCard class="rounded-[1.75rem]">
    <template #header>
      <div>
        <h2 class="text-lg font-semibold text-slate-950 dark:text-white">Proformas</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Consulta, retoma e imprime proformas emitidas.</p>
      </div>
    </template>

    <UiEmptySearchState
      v-if="!loading && rows.length === 0"
      title="Sin proformas"
      description="Todavía no hay proformas emitidas para mostrar."
      icon="i-lucide-file-stack"
    />

    <div v-else class="space-y-3">
      <div
        v-for="row in rows"
        :key="row.id"
        class="flex flex-col gap-4 rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between"
      >
        <div class="space-y-1">
          <p class="text-base font-semibold text-slate-950 dark:text-white">
            Proforma #{{ row.proforma_number }}
          </p>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            OV {{ row.sales_order_id }} · Estado {{ row.status }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton v-if="canView" size="sm" variant="soft" color="neutral" @click="emits('view', row.id)">Ver</UButton>
          <UButton size="sm" variant="soft" color="neutral" :disabled="row.status !== 'issued'" @click="emits('resume', row.id)">Retomar</UButton>
          <UButton size="sm" color="primary" variant="soft" @click="emits('print', row.id)">Imprimir</UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>

