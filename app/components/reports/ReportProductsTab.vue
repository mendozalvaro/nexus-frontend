<script setup lang="ts">
import type { ProductsReportData } from "@/composables/useReports";

import ReportKpiStrip from "./ReportKpiStrip.vue";
import ReportChart from "./ReportChart.vue";
import ReportDataTable from "./ReportDataTable.vue";

const props = defineProps<{
  data: ProductsReportData | null;
  loading: boolean;
}>();

const topProductsData = computed(() => props.data?.topProducts ?? []);

const rotationData = computed(() => props.data?.rotation ?? []);

const lowStockData = computed(() => props.data?.lowStock ?? []);

const movementData = computed(() => props.data?.movementSummary ?? []);
</script>

<template>
  <div class="space-y-6">
    <ReportKpiStrip :kpis="data?.kpis ?? []" :loading="loading" />

    <div class="grid gap-6 lg:grid-cols-2">
      <ReportChart
        title="Top 10 productos"
        subtitle="Productos mas vendidos por unidades"
        type="bar"
        :categories="topProductsData.map((d) => d.label)"
        :series="[{ name: 'Unidades vendidas', data: topProductsData.map((d) => d.value) }]"
        :loading="loading"
        empty-message="No hay productos vendidos en este periodo"
      />

      <ReportChart
        title="Rotacion de inventario"
        subtitle="Relacion unidades vendidas / stock actual"
        type="bar"
        :categories="rotationData.map((d) => d.label)"
        :series="[{ name: 'Rotacion (x)', data: rotationData.map((d) => d.value) }]"
        :loading="loading"
        empty-message="No hay datos de rotacion"
      />
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <UCard class="rounded-[1.5rem] border border-white/60 bg-white/85 dark:border-slate-800 dark:bg-slate-900/80">
        <template #header>
          <h3 class="text-base font-semibold text-slate-950 dark:text-white">
            Alertas de stock bajo
          </h3>
          <p v-if="lowStockData.length > 0" class="mt-1 text-sm text-rose-600 dark:text-rose-400">
            {{ lowStockData.length }} productos por debajo del minimo
          </p>
        </template>

        <div v-if="loading" class="space-y-3">
          <div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        </div>

        <div v-else-if="lowStockData.length === 0" class="py-8 text-center">
          <UIcon name="i-lucide-circle-check" class="mx-auto h-10 w-10 text-emerald-400" />
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Todos los productos tienen stock suficiente
          </p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="item in lowStockData"
            :key="item.label"
            class="flex items-center justify-between rounded-2xl border border-rose-200/70 bg-rose-50/60 px-4 py-3 dark:border-rose-900/50 dark:bg-rose-950/30"
          >
            <div>
              <p class="text-sm font-medium text-slate-900 dark:text-white">
                {{ item.label }}
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ item.meta }}
              </p>
            </div>
            <span class="rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
              {{ item.value }} uds
            </span>
          </div>
        </div>
      </UCard>

      <ReportChart
        title="Movimientos de inventario"
        subtitle="Resumen por tipo de movimiento"
        type="donut"
        :donut-data="movementData"
        :loading="loading"
        empty-message="No hay movimientos en este periodo"
      />
    </div>

    <ReportDataTable
      :rows="data?.tableRows ?? []"
      :loading="loading"
      empty-message="No hay productos vendidos en este periodo"
    />
  </div>
</template>
