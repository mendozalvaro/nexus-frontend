<script setup lang="ts">
import type { ApexOptions } from "apexcharts";
import { defineAsyncComponent } from "vue";

const props = withDefaults(defineProps<{
  title: string;
  subtitle?: string;
  type?: "bar" | "line" | "donut";
  categories?: string[];
  series: Array<{ name: string; data: number[] }>;
  height?: number;
  loading?: boolean;
}>(), {
  subtitle: "",
  type: "bar",
  categories: () => [],
  height: 320,
  loading: false,
});

const ApexChart = import.meta.client
  ? defineAsyncComponent(() => import("vue3-apexcharts"))
  : null;

const chartOptions = computed<ApexOptions>(() => ({
  chart: {
    toolbar: { show: false },
    background: "transparent",
    foreColor: "#64748b",
  },
  theme: {
    monochrome: { enabled: false },
  },
  colors: ["#0f766e", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed"],
  stroke: {
    curve: "smooth",
    width: props.type === "line" ? 3 : 0,
  },
  xaxis: {
    categories: props.categories,
    labels: {
      rotate: -30,
      trim: true,
    },
  },
  plotOptions: {
    bar: {
      borderRadius: 8,
      columnWidth: "46%",
    },
    pie: {
      donut: {
        labels: {
          show: props.type === "donut",
        },
      },
    },
  },
  dataLabels: {
    enabled: props.type === "donut",
  },
  legend: {
    position: "bottom",
  },
  tooltip: {
    y: {
      formatter: (value: number) => new Intl.NumberFormat("es-BO", { maximumFractionDigits: 2 }).format(value),
    },
  },
  grid: {
    borderColor: "rgba(148, 163, 184, 0.16)",
  },
  labels: props.type === "donut" ? props.categories : undefined,
}));

const resolvedSeries = computed(() => {
  if (props.type === "donut") {
    return props.series.flatMap((entry) => entry.data);
  }

  return props.series;
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
