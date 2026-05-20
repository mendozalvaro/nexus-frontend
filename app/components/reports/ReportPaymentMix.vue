<script setup lang="ts">
import type { ReportsOverviewData } from "@/composables/useReports";

import ReportChart from "./ReportChart.vue";

const props = defineProps<{
  overviewData: ReportsOverviewData | null;
}>();

const paymentData = computed(() => props.overviewData?.paymentMix ?? []);
</script>

<template>
  <UCard class="rounded-2xl border border-white/60 bg-white/85 dark:border-slate-800 dark:bg-slate-900/80">
    <template #header>
      <h3 class="text-base font-semibold text-slate-950 dark:text-white">
        Como me pagaron
      </h3>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Distribucion por metodo de pago
      </p>
    </template>

    <ReportChart
      type="donut"
      :donut-data="paymentData"
      empty-message="No hay transacciones para analizar"
    />
  </UCard>
</template>
