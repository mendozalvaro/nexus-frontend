<script setup lang="ts">
import type { ServicesReportData } from "@/composables/useReports";

import ReportKpiStrip from "./ReportKpiStrip.vue";
import ReportChart from "./ReportChart.vue";
import ReportDataTable from "./ReportDataTable.vue";

const props = defineProps<{
  data: ServicesReportData | null;
  loading: boolean;
}>();

const topServicesData = computed(() => props.data?.topServices ?? []);

const employeeProductivityData = computed(() => props.data?.employeeProductivity ?? []);

const serviceMixData = computed(() => props.data?.serviceMix ?? []);
</script>

<template>
  <div class="space-y-6">
    <ReportKpiStrip :kpis="data?.kpis ?? []" :loading="loading" />

    <div class="grid gap-6 lg:grid-cols-2">
      <ReportChart
        title="Top servicios por ingreso"
        subtitle="Servicios que mas generan"
        type="bar"
        :categories="topServicesData.map((d) => d.label)"
        :series="[{ name: 'Ingresos', data: topServicesData.map((d) => d.value) }]"
        :loading="loading"
        empty-message="No hay servicios vendidos en este periodo"
      />

      <ReportChart
        title="Mix de servicios"
        subtitle="Distribucion por volumen"
        type="donut"
        :donut-data="serviceMixData"
        :loading="loading"
        empty-message="No hay servicios para analizar"
      />
    </div>

    <ReportChart
      title="Productividad por empleado"
      subtitle="Ingresos generados por servicios"
      type="bar"
      :categories="employeeProductivityData.map((d) => d.label)"
      :series="[{ name: 'Ingresos por servicios', data: employeeProductivityData.map((d) => d.value) }]"
      :loading="loading"
      empty-message="No hay datos de productividad"
    />

    <ReportDataTable
      :rows="data?.tableRows ?? []"
      :loading="loading"
      empty-message="No hay servicios vendidos en este periodo"
    />
  </div>
</template>
