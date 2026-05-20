<script setup lang="ts">
import type { ReportChartDatum } from "@/composables/useReports";

const props = withDefaults(defineProps<{
  title?: string;
  subtitle?: string;
  type?: "bar" | "line" | "donut";
  categories?: string[];
  series?: Array<{ name: string; data: number[] }>;
  donutData?: ReportChartDatum[];
  height?: number;
  loading?: boolean;
  emptyMessage?: string;
}>(), {
  title: "",
  subtitle: "",
  type: "bar",
  categories: () => [],
  series: () => [],
  donutData: () => [],
  height: 320,
  loading: false,
  emptyMessage: "Sin datos disponibles",
});

const ApexChart = import.meta.client ? defineAsyncComponent(() => import("vue3-apexcharts")) : null;

const chartOptions = computed(() => ({
  chart: {
    toolbar: { show: false },
    background: "transparent",
    foreColor: "#64748b",
  },
  colors: ["#0f766e", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed", "#06b6d4"],
  stroke: {
    curve: "smooth" as const,
    width: props.type === "line" ? 3 : 0,
  },
  xaxis: {
    categories: props.categories ?? [],
    labels: { rotate: -30, trim: true },
  },
  plotOptions: {
    bar: { borderRadius: 8, columnWidth: "46%" },
    pie: {
      donut: { labels: { show: props.type === "donut" } },
    },
  },
  dataLabels: { enabled: props.type === "donut" },
  legend: { position: "bottom" as const },
  tooltip: {
    y: {
      formatter: (value: number) =>
        new Intl.NumberFormat("es-BO", { maximumFractionDigits: 2 }).format(value),
    },
  },
  grid: { borderColor: "rgba(148, 163, 184, 0.16)" },
  labels: props.type === "donut" ? (props.donutData ?? []).map((d) => d.label) : undefined,
}));

const donutSeries = computed(() => {
  if (props.type !== "donut") return [];
  return (props.donutData ?? []).map((d) => d.value);
});

const resolvedSeries = computed(() => {
  if (props.type === "donut") return donutSeries.value;
  return props.series ?? [];
});

const hasData = computed(() => {
  if (props.type === "donut") {
    const data = props.donutData ?? [];
    return data.length > 0 && data.some((d) => d.value > 0);
  }
  const series = props.series ?? [];
  if (series.length === 0) return false;
  return series.some((s) => (s.data ?? []).some((v) => v > 0));
});
</script>

<template>
  <UCard class="rounded-[1.5rem] border border-white/60 bg-white/85 dark:border-slate-800 dark:bg-slate-900/80">
    <template #header>
      <div>
        <h3 class="text-base font-semibold text-slate-950 dark:text-white">
          {{ title }}
        </h3>
        <p v-if="subtitle" class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ subtitle }}
        </p>
      </div>
    </template>

    <div v-if="loading" class="h-[320px] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />

    <div v-else-if="!hasData" class="flex h-[320px] items-center justify-center">
      <div class="text-center">
        <UIcon name="i-lucide-chart-bar" class="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {{ emptyMessage }}
        </p>
      </div>
    </div>

    <ClientOnly v-else>
      <component
        :is="ApexChart"
        v-if="ApexChart"
        :type="type"
        :height="height"
        :options="chartOptions"
        :series="resolvedSeries"
      />
      <template #fallback>
        <div class="h-[320px] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </template>
    </ClientOnly>
  </UCard>
</template>
