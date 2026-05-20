<script setup lang="ts">
import type { ImportSummary } from "@/composables/useCatalogImport";

const props = defineProps<{
  summary: ImportSummary;
}>();

const entityLabels: Record<string, string> = {
  categories: "categorias",
  products: "productos",
  services: "servicios",
};
</script>

<template>
  <div class="space-y-6">
    <div class="text-center">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
        <UIcon name="i-heroicons-check-circle" class="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h3 class="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Importacion completada</h3>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Se procesaron {{ summary.totalRows }} {{ entityLabels[summary.entityType] ?? summary.entityType }}.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-900">
        <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ summary.result.created }}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">Creados</p>
      </div>

      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-900">
        <p class="text-2xl font-bold text-sky-600 dark:text-sky-400">{{ summary.result.updated }}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">Actualizados</p>
      </div>

      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-900">
        <p class="text-2xl font-bold text-amber-600 dark:text-amber-400">{{ summary.result.skipped }}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">Saltados</p>
      </div>
    </div>

    <UAlert
      v-if="summary.result.errors.length > 0"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-circle"
      :title="`${summary.result.errors.length} error(es) durante la importacion`"
    >
      <template #description>
        <ul class="mt-2 space-y-1 text-xs">
          <li v-for="(err, idx) in summary.result.errors.slice(0, 5)" :key="idx">
            Fila {{ err.rowIndex }}: {{ err.field }} — {{ err.message }}
          </li>
          <li v-if="summary.result.errors.length > 5" class="text-slate-500">
            Y {{ summary.result.errors.length - 5 }} errores mas...
          </li>
        </ul>
      </template>
    </UAlert>
  </div>
</template>
