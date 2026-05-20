<script setup lang="ts">
import type { ReportKpi } from "@/composables/useReports";

const props = withDefaults(defineProps<{
  kpis: ReportKpi[];
  loading?: boolean;
}>(), {
  loading: false,
});

const toneIconMap: Record<string, string> = {
  primary: "i-lucide-trending-up",
  success: "i-lucide-circle-check",
  warning: "i-lucide-triangle-alert",
  error: "i-lucide-circle-x",
  neutral: "i-lucide-info",
};

const toneBgMap: Record<string, string> = {
  primary: "bg-primary-500/12 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300",
  success: "bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  warning: "bg-amber-500/12 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  error: "bg-rose-500/12 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  neutral: "bg-slate-500/12 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
};
</script>

<template>
  <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <template v-if="loading">
      <UCard
        v-for="i in 4"
        :key="i"
        class="rounded-[1.5rem] border border-white/60 bg-white/85 dark:border-slate-800 dark:bg-slate-900/80"
      >
        <div class="space-y-3">
          <div class="h-3 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <div class="h-8 w-32 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <div class="h-3 w-40 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
      </UCard>
    </template>

    <UCard
      v-for="kpi in kpis"
      :key="kpi.label"
      class="rounded-[1.5rem] border border-white/60 bg-white/85 dark:border-slate-800 dark:bg-slate-900/80"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 space-y-2">
          <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {{ kpi.label }}
          </p>
          <p class="truncate text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            {{ kpi.value }}
          </p>
          <p v-if="kpi.meta" class="text-xs text-slate-500 dark:text-slate-400">
            {{ kpi.meta }}
          </p>
        </div>
        <div :class="['flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', toneBgMap[kpi.tone ?? 'neutral']]">
          <UIcon :name="toneIconMap[kpi.tone ?? 'neutral']" class="h-5 w-5" />
        </div>
      </div>
    </UCard>
  </section>
</template>
