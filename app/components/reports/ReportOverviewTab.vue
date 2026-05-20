<script setup lang="ts">
import type { ReportsOverviewData } from "@/composables/useReports";

import ReportKpiStrip from "./ReportKpiStrip.vue";
import ReportChart from "./ReportChart.vue";

const props = defineProps<{
  data: ReportsOverviewData | null;
  loading: boolean;
}>();

const trendCategories = computed(() =>
  props.data?.salesTrend.map((d) => d.label) ?? [],
);

const trendSeries = computed(() => [
  { name: "Ventas netas", data: props.data?.salesTrend.map((d) => d.value) ?? [] },
]);

const paymentMixData = computed(() => props.data?.paymentMix ?? []);

const appointmentStatusData = computed(() => props.data?.appointmentStatusMix ?? []);

const branchComparisonData = computed(() => props.data?.branchComparison ?? []);
</script>

<template>
  <div class="space-y-6">
    <ReportKpiStrip :kpis="data?.kpis ?? []" :loading="loading" />

    <div class="grid gap-6 lg:grid-cols-2">
      <ReportChart
        title="Tendencia de ventas"
        subtitle="Ingreso diario en el periodo seleccionado"
        type="line"
        :categories="trendCategories"
        :series="trendSeries"
        :loading="loading"
        empty-message="No hay ventas registradas en este periodo"
      />

      <ReportChart
        title="Mix de pagos"
        subtitle="Distribucion por metodo de pago"
        type="donut"
        :donut-data="paymentMixData"
        :loading="loading"
        empty-message="No hay transacciones para analizar"
      />
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <ReportChart
        title="Estado de citas"
        subtitle="Distribucion por estado"
        type="donut"
        :donut-data="appointmentStatusData"
        :loading="loading"
        empty-message="No hay citas registradas en este periodo"
      />

      <ReportChart
        v-if="data?.canCompareBranches"
        title="Comparativa por sucursal"
        subtitle="Ventas netas por sucursal"
        type="bar"
        :categories="branchComparisonData.map((d) => d.label)"
        :series="[{ name: 'Ventas netas', data: branchComparisonData.map((d) => d.value) }]"
        :loading="loading"
        empty-message="Selecciona multiples sucursales para comparar"
      />

      <UCard
        v-else
        class="rounded-[1.5rem] border border-white/60 bg-white/85 dark:border-slate-800 dark:bg-slate-900/80"
      >
        <template #header>
          <h3 class="text-base font-semibold text-slate-950 dark:text-white">
            Comparativa por sucursal
          </h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Disponible para admin con multiples sucursales
          </p>
        </template>
        <div class="flex h-[320px] items-center justify-center">
          <div class="text-center">
            <UIcon name="i-lucide-lock" class="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Actualiza tu plan para habilitar comparativas entre sucursales
            </p>
          </div>
        </div>
      </UCard>
    </div>

    <UCard class="rounded-[1.5rem] border border-white/60 bg-white/85 dark:border-slate-800 dark:bg-slate-900/80">
      <template #header>
        <h3 class="text-base font-semibold text-slate-950 dark:text-white">
          Resumen rapido
        </h3>
      </template>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="item in data?.topHighlights ?? []"
          :key="item.label"
          class="rounded-2xl border border-slate-200/70 bg-slate-50/90 px-4 py-4 dark:border-slate-800/80 dark:bg-slate-800/60"
        >
          <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {{ item.label }}
          </p>
          <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            {{ item.value }}
          </p>
          <p v-if="item.secondary" class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {{ item.secondary }}
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
