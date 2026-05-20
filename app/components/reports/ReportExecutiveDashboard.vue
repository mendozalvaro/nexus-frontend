<script setup lang="ts">
import type { ReportsOverviewData, SalesReportData, ProductsReportData, ServicesReportData } from "@/composables/useReports";

import ReportChart from "./ReportChart.vue";

const props = defineProps<{
  overviewData: ReportsOverviewData | null;
  salesData: SalesReportData | null;
  productsData: ProductsReportData | null;
  servicesData: ServicesReportData | null;
  loading: boolean;
}>();

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 0 }).format(amount);

const formatInteger = (value: number) => new Intl.NumberFormat("es-BO").format(value);

const kpiCards = computed(() => {
  const overview = props.overviewData;
  if (!overview) return [];

  const salesTrend = overview.salesTrend ?? [];
  const totalSales = salesTrend.reduce((sum, d) => sum + d.value, 0);
  const completedTx = overview.kpis.find((k) => k.label === "Ventas netas")?.meta ?? "";
  const avgTicket = overview.kpis.find((k) => k.label === "Ticket promedio")?.value ?? "Bs 0";
  const cancelRate = overview.kpis.find((k) => k.label === "Tasa de cancelacion")?.value ?? "0%";
  const appointmentRows = overview.appointmentStatusMix ?? [];
  const completedAppts = appointmentRows.find((a) => a.label === "Completada")?.value ?? 0;
  const totalAppts = appointmentRows.reduce((sum, a) => sum + a.value, 0);
  const completionRate = totalAppts === 0 ? "0%" : `${Math.round((completedAppts / totalAppts) * 100)}%`;

  return [
    {
      icon: "i-lucide-trending-up",
      label: "Vendí",
      value: formatCurrency(totalSales),
      meta: completedTx,
      tone: "primary" as const,
    },
    {
      icon: "i-lucide-receipt",
      label: "Tickets",
      value: formatInteger(salesTrend.length > 0 ? salesTrend.filter((d) => d.value > 0).length : 0),
      meta: `Promedio: ${avgTicket}`,
      tone: "success" as const,
    },
    {
      icon: "i-lucide-calendar-check",
      label: "Citas",
      value: `${formatInteger(completedAppts)}/${formatInteger(totalAppts)}`,
      meta: `${completionRate} completadas`,
      tone: "warning" as const,
    },
    {
      icon: "i-lucide-circle-alert",
      label: "Cancelación",
      value: cancelRate,
      meta: "Tasa del periodo",
      tone: "error" as const,
    },
  ];
});

const trendCategories = computed(() =>
  props.overviewData?.salesTrend.map((d) => d.label) ?? [],
);

const trendSeries = computed(() => [
  { name: "Ventas", data: props.overviewData?.salesTrend.map((d) => d.value) ?? [] },
]);
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UCard
        v-for="kpi in kpiCards"
        :key="kpi.label"
        class="rounded-2xl border border-white/60 bg-white/85 dark:border-slate-800 dark:bg-slate-900/80"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              {{ kpi.label }}
            </p>
            <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
              {{ kpi.value }}
            </p>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{ kpi.meta }}
            </p>
          </div>
          <UIcon :name="kpi.icon" class="h-8 w-8 text-slate-300 dark:text-slate-600" />
        </div>
      </UCard>
    </div>

    <ReportChart
      title="Tendencia de ventas"
      subtitle="Ingreso diario en el periodo seleccionado"
      type="line"
      :categories="trendCategories"
      :series="trendSeries"
      :loading="loading"
      empty-message="No hay ventas registradas en este periodo"
    />
  </div>
</template>
