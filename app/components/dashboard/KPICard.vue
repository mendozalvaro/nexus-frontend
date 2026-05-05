<script setup lang="ts">
import type { DashboardMetricItem } from "@/composables/useDashboard";

const props = withDefaults(defineProps<{
  title: string;
  icon: string;
  value?: string;
  subtitle?: string;
  items?: DashboardMetricItem[];
  loading?: boolean;
  tone?: "primary" | "success" | "warning" | "error";
}>(), {
  value: undefined,
  subtitle: undefined,
  items: () => [],
  loading: false,
  tone: "primary",
});

const toneClasses: Record<NonNullable<typeof props.tone>, string> = {
  primary: "bg-primary-500/12 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300",
  success: "bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  warning: "bg-amber-500/12 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  error: "bg-rose-500/12 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
};
</script>

<template>
  <UCard class="admin-shell-panel h-full rounded-[1.75rem]">
    <div v-if="loading" class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="h-4 w-32 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        <div class="h-10 w-10 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>
      <div class="h-8 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
      <div class="space-y-2">
        <div class="h-3 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        <div class="h-3 w-4/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>

    <div v-else class="flex h-full flex-col">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {{ title }}
          </p>
          <p v-if="value" class="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-[2rem]">
            {{ value }}
          </p>
        </div>

        <div :class="['flex h-12 w-12 items-center justify-center rounded-2xl', toneClasses[tone]]">
          <UIcon :name="icon" class="h-6 w-6" />
        </div>
      </div>

      <p v-if="subtitle" class="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {{ subtitle }}
      </p>

      <div v-if="items.length > 0" class="mt-5 space-y-3">
        <div
          v-for="item in items"
          :key="`${title}-${item.label}`"
          class="admin-interactive flex items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/90 px-4 py-3 hover:border-slate-300 hover:bg-white dark:border-slate-800/80 dark:bg-slate-800/60 dark:hover:border-slate-700 dark:hover:bg-slate-800/80"
        >
          <div>
            <p class="text-sm font-medium text-slate-800 dark:text-slate-100">
              {{ item.label }}
            </p>
            <p v-if="item.meta" class="text-xs text-slate-600 dark:text-slate-300">
              {{ item.meta }}
            </p>
          </div>

          <p class="text-sm font-semibold text-slate-950 dark:text-white">
            {{ item.value }}
          </p>
        </div>
      </div>
    </div>
  </UCard>
</template>
