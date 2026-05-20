<script setup lang="ts">
import type { SalesReportData } from "@/composables/useReports";

import ReportKpiStrip from "./ReportKpiStrip.vue";
import ReportChart from "./ReportChart.vue";
import ReportDataTable from "./ReportDataTable.vue";

const props = defineProps<{
  data: SalesReportData | null;
  loading: boolean;
}>();

const trendCategories = computed(() =>
  props.data?.salesTrend.map((d) => d.label) ?? [],
);

const trendSeries = computed(() => [
  { name: "Ventas netas", data: props.data?.salesTrend.map((d) => d.value) ?? [] },
]);

const paymentData = computed(() => props.data?.paymentBreakdown ?? []);

const branchData = computed(() => props.data?.branchBreakdown ?? []);

const employeeData = computed(() => props.data?.employeeBreakdown ?? []);
</script>

<template>
  <div class="space-y-6">
    <ReportKpiStrip :kpis="data?.kpis ?? []" :loading="loading" />

    <ReportChart
      title="Tendencia de ventas"
      subtitle="Ingreso diario en el periodo seleccionado"
      type="line"
      :categories="trendCategories"
      :series="trendSeries"
      :loading="loading"
      empty-message="No hay ventas registradas en este periodo"
    />

    <div class="grid gap-6 lg:grid-cols-2">
      <ReportChart
        title="Desglose por metodo de pago"
        subtitle="Ventas agrupadas por forma de pago"
        type="donut"
        :donut-data="paymentData"
        :loading="loading"
        empty-message="No hay transacciones para analizar"
      />

      <ReportChart
        title="Desglose por sucursal"
        subtitle="Ventas netas por sucursal"
        type="bar"
        :categories="branchData.map((d) => d.label)"
        :series="[{ name: 'Ventas netas', data: branchData.map((d) => d.value) }]"
        :loading="loading"
        empty-message="No hay datos por sucursal"
      />
    </div>

    <ReportChart
      title="Desglose por empleado"
      subtitle="Ventas netas por responsable"
      type="bar"
      :categories="employeeData.map((d) => d.label)"
      :series="[{ name: 'Ventas netas', data: employeeData.map((d) => d.value) }]"
      :loading="loading"
      empty-message="No hay datos por empleado"
    />

    <ReportDataTable
      :rows="data?.transactionsTable ?? []"
      :loading="loading"
      empty-message="No hay transacciones completadas en este periodo"
    />
  </div>
</template>
