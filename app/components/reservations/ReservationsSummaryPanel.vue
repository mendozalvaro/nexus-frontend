<script setup lang="ts">
defineProps<{
  total: number;
  checkedIn: number;
  checkedOut: number;
  withBalance: number;
}>();
</script>

<template>
  <UiSectionShell
    eyebrow="Resumen"
    title="Vista general del hospedaje"
    description="Indicadores rapidos del estado actual del hospedaje."
  >
    <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
      <UiStatCard label="Total estadias" :value="total" icon="i-lucide-calendar-days" icon-class="text-sky-600 dark:text-sky-300" icon-wrapper-class="bg-sky-100 dark:bg-sky-950/50" />
      <UiStatCard label="En uso" :value="checkedIn" icon="i-lucide-bed-double" icon-class="text-emerald-600 dark:text-emerald-300" icon-wrapper-class="bg-emerald-100 dark:bg-emerald-950/50" />
      <UiStatCard label="Salidas registradas" :value="checkedOut" icon="i-lucide-log-out" icon-class="text-amber-600 dark:text-amber-300" icon-wrapper-class="bg-amber-100 dark:bg-amber-950/50" />
      <UiStatCard label="Con saldo" :value="withBalance" icon="i-lucide-credit-card" icon-class="text-slate-600 dark:text-slate-300" icon-wrapper-class="bg-slate-100 dark:bg-slate-900/60" />
    </div>
  </UiSectionShell>
</template>
