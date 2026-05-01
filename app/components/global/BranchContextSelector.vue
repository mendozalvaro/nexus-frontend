<script setup lang="ts">
import type { ModuleBranchKey } from "@/composables/useModuleBranchContext";

const props = withDefaults(defineProps<{
  moduleKey: ModuleBranchKey;
  title?: string;
  description?: string;
}>(), {
  title: "Contexto de sucursal",
  description: "Selecciona la sucursal operativa para este modulo.",
});

const {
  branches,
  selectedBranchId,
  selectedBranch,
  canSwitch,
  loading,
} = useModuleBranchContext(props.moduleKey);

const branchModel = computed({
  get: () => selectedBranchId.value ?? "",
  set: (value: string) => {
    selectedBranchId.value = value || null;
  },
});
</script>

<template>
  <UCard
    class="rounded-[1.5rem] border border-slate-200/80 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:shadow-black/20"
  >
    <template #header>
      <div class="space-y-1">
        <h3 class="text-lg font-semibold text-slate-950 dark:text-white">
          {{ title }}
        </h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ description }}
        </p>
      </div>
    </template>

    <div v-if="branches.length === 0" class="space-y-3">
      <UAlert
        color="warning"
        variant="soft"
        icon="i-lucide-triangle-alert"
        title="Sin sucursales activas"
        description="No hay sucursales activas disponibles para operar en este modulo."
      />
    </div>

    <div v-else-if="canSwitch" class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        Sucursal activa
      </p>
      <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
        <select v-model="branchModel" class="w-full bg-transparent outline-none" :disabled="loading">
          <option v-for="branch in branches" :key="branch.id" :value="branch.id">
            {{ branch.code ? `${branch.name} (${branch.code})` : branch.name }}
          </option>
        </select>
      </div>
    </div>

    <div v-else class="space-y-1">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        Sucursal activa
      </p>
      <p class="text-sm font-semibold text-slate-900 dark:text-white">
        {{ selectedBranch?.name ?? "Sin sucursal" }}
      </p>
    </div>
  </UCard>
</template>

