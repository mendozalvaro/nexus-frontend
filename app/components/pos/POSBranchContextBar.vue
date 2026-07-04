<script setup lang="ts">
import type { POSBranchOption } from "@/composables/usePOS";

const props = defineProps<{
  branches: POSBranchOption[];
  selectedBranchId: string;
  canSwitch: boolean;
}>();

const emits = defineEmits<{
  "update:selectedBranchId": [value: string];
}>();

const selectedBranch = computed(() =>
  props.branches.find((branch) => branch.id === props.selectedBranchId) ?? props.branches[0] ?? null,
);
</script>

<template>
  <UCard class="rounded-[1.5rem]">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Contexto operativo
        </p>
        <h2 class="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
          Ventas - Venta asistida
        </h2>
      </div>

      <div class="w-full max-w-md">
        <label class="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
          Sucursal activa
        </label>
        <USelect
          v-if="canSwitch"
          :model-value="selectedBranchId"
          :items="branches.map((branch) => ({ label: `${branch.name}${branch.code ? ` (${branch.code})` : ''}`, value: branch.id }))"
          label-key="label"
          value-key="value"
          class="w-full"
          @update:model-value="emits('update:selectedBranchId', String($event ?? ''))"
        />
        <div
          v-else
          class="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200"
        >
          {{ selectedBranch?.name ?? "Sin sucursal activa" }}
        </div>
      </div>
    </div>
  </UCard>
</template>
