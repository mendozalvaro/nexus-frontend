<script setup lang="ts">
import type { AppointmentsReportData } from "@/composables/useReports";

import ReportKpiStrip from "./ReportKpiStrip.vue";
import ReportChart from "./ReportChart.vue";
import ReportDataTable from "./ReportDataTable.vue";

const props = defineProps<{
  data: AppointmentsReportData | null;
  loading: boolean;
}>();

const statusData = computed(() => props.data?.statusBreakdown ?? []);

const employeeOccupancyData = computed(() => props.data?.employeeOccupancy ?? []);

const serviceDemandData = computed(() => props.data?.serviceDemand ?? []);
</script>

<template>
  <div class="space-y-6">
    <ReportKpiStrip :kpis="data?.kpis ?? []" :loading="loading" />

    <div class="grid gap-6 lg:grid-cols-2">
      <ReportChart
        title="Estado de citas"
        subtitle="Distribucion por estado"
        type="donut"
        :donut-data="statusData"
        :loading="loading"
        empty-message="No hay citas registradas en este periodo"
      />

      <ReportChart
        title="Demanda por servicio"
        subtitle="Servicios mas solicitados"
        type="bar"
        :categories="serviceDemandData.map((d) => d.label)"
        :series="[{ name: 'Citas', data: serviceDemandData.map((d) => d.value) }]"
        :loading="loading"
        empty-message="No hay datos de demanda"
      />
    </div>

    <ReportChart
      title="Ocupacion del equipo"
      subtitle="Porcentaje de tiempo agendado vs jornada laboral"
      type="bar"
      :categories="employeeOccupancyData.map((d) => d.label)"
      :series="[{ name: 'Ocupacion (%)', data: employeeOccupancyData.map((d) => d.value) }]"
      :loading="loading"
      empty-message="No hay datos de ocupacion"
    />

    <ReportDataTable
      :rows="data?.tableRows ?? []"
      :loading="loading"
      empty-message="No hay citas registradas en este periodo"
    />
  </div>
</template>
