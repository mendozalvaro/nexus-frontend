<script setup lang="ts">
import type { ImportPreviewResult } from "@/composables/useCatalogImport";

const props = defineProps<{
  previewResult: ImportPreviewResult;
  totalRows: number;
  duplicateStrategy: "upsert" | "skip";
}>();

const emit = defineEmits<{
  "update:duplicateStrategy": ["upsert" | "skip"];
}>();
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-900">
        <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ previewResult.validRows }}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">Filas validas</p>
      </div>

      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-900">
        <p class="text-2xl font-bold text-rose-600 dark:text-rose-400">{{ previewResult.invalidRows }}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">Filas invalidas</p>
      </div>

      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-900">
        <p class="text-2xl font-bold text-amber-600 dark:text-amber-400">{{ previewResult.duplicates.length }}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">Duplicados</p>
      </div>
    </div>

    <UAlert
      v-if="previewResult.validationErrors.length > 0"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-circle"
      :title="`${previewResult.validationErrors.length} error(es) de validacion`"
    >
      <template #description>
        <ul class="mt-2 space-y-1 text-xs">
          <li v-for="(err, idx) in previewResult.validationErrors.slice(0, 5)" :key="idx">
            Fila {{ err.rowIndex }}: {{ err.field }} — {{ err.message }}
          </li>
          <li v-if="previewResult.validationErrors.length > 5" class="text-slate-500">
            Y {{ previewResult.validationErrors.length - 5 }} errores mas...
          </li>
        </ul>
      </template>
    </UAlert>

    <div v-if="previewResult.duplicates.length > 0" class="space-y-3">
      <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Estrategia para duplicados</p>
      <div class="flex gap-4">
        <label class="flex items-center gap-2">
          <input type="radio" value="skip" :checked="duplicateStrategy === 'skip'" class="h-4 w-4" @change="emit('update:duplicateStrategy', 'skip')" />
          <span class="text-sm text-slate-700 dark:text-slate-300">Saltar duplicados</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="radio" value="upsert" :checked="duplicateStrategy === 'upsert'" class="h-4 w-4" @change="emit('update:duplicateStrategy', 'upsert')" />
          <span class="text-sm text-slate-700 dark:text-slate-300">Actualizar existentes</span>
        </label>
      </div>
    </div>
  </div>
</template>
