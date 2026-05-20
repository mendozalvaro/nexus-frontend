<script setup lang="ts">
const props = withDefaults(defineProps<{
  rows: Array<Record<string, string | number>>;
  loading?: boolean;
  emptyMessage?: string;
}>(), {
  loading: false,
  emptyMessage: "Sin datos para mostrar",
});
</script>

<template>
  <UCard class="rounded-[1.5rem] border border-white/60 bg-white/85 dark:border-slate-800 dark:bg-slate-900/80">
    <template #header>
      <h3 class="text-base font-semibold text-slate-950 dark:text-white">
        Detalle
      </h3>
    </template>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
    </div>

    <div v-else-if="rows.length === 0" class="py-12 text-center">
      <UIcon name="i-lucide-table" class="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {{ emptyMessage }}
      </p>
    </div>

    <div v-else class="overflow-x-auto">
      <UTable :data="rows" class="min-w-full" />
    </div>
  </UCard>
</template>
