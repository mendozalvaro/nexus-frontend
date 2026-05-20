<script setup lang="ts">
import type { SalesReportData, ServicesReportData } from "@/composables/useReports";

const props = defineProps<{
  salesData: SalesReportData | null;
  servicesData: ServicesReportData | null;
}>();

interface EmployeeRank {
  name: string;
  sales: number;
  services: number;
  total: number;
}

const rankings = computed<EmployeeRank[]>(() => {
  const map = new Map<string, { sales: number; services: number }>();

  const salesBreakdown = props.salesData?.employeeBreakdown ?? [];
  for (const item of salesBreakdown) {
    const existing = map.get(item.label) ?? { sales: 0, services: 0 };
    existing.sales += item.value;
    map.set(item.label, existing);
  }

  const servicesBreakdown = props.servicesData?.employeeProductivity ?? [];
  for (const item of servicesBreakdown) {
    const existing = map.get(item.label) ?? { sales: 0, services: 0 };
    existing.services += item.value;
    map.set(item.label, existing);
  }

  const result: EmployeeRank[] = [];
  for (const [name, data] of map.entries()) {
    result.push({
      name,
      sales: data.sales,
      services: data.services,
      total: data.sales + data.services,
    });
  }

  result.sort((a, b) => b.total - a.total);
  return result.slice(0, 5);
});

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 0 }).format(amount);
</script>

<template>
  <UCard class="rounded-2xl border border-white/60 bg-white/85 dark:border-slate-800 dark:bg-slate-900/80">
    <template #header>
      <h3 class="text-base font-semibold text-slate-950 dark:text-white">
        Ranking equipo
      </h3>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Quien vendio mas en el periodo
      </p>
    </template>

    <div v-if="rankings.length === 0" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
      Sin datos en este periodo
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="(emp, index) in rankings"
        :key="emp.name"
        class="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50/90 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-800/60"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          :class="{
            'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300': index === 0,
            'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300': index === 1,
            'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300': index === 2,
            'bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500': index > 2,
          }"
        >
          {{ index + 1 }}
        </span>
        <UIcon name="i-lucide-user" class="h-5 w-5 text-slate-400 dark:text-slate-500" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-slate-900 dark:text-white">
            {{ emp.name }}
          </p>
        </div>
        <div class="shrink-0 text-right">
          <p class="text-sm font-semibold text-slate-950 dark:text-white">
            {{ formatCurrency(emp.total) }}
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ emp.services }} servicios
          </p>
        </div>
      </div>
    </div>
  </UCard>
</template>
