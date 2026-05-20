<script setup lang="ts">
import type { ReportFilters, ReportBranchOption, ReportEmployeeOption } from "../../composables/useReports";

const props = withDefaults(defineProps<{
  modelValue: ReportFilters;
  branchOptions?: ReportBranchOption[];
  employeeOptions?: ReportEmployeeOption[];
  showBranches?: boolean;
  showEmployees?: boolean;
  loading?: boolean;
  branchHelp?: string | null;
}>(), {
  branchOptions: () => [],
  employeeOptions: () => [],
  showBranches: true,
  showEmployees: true,
  loading: false,
  branchHelp: null,
});

const emit = defineEmits<{
  "update:modelValue": [value: ReportFilters];
  apply: [];
  reset: [];
  "export:csv": [];
  "export:pdf": [];
}>();

const localFilters = reactive<ReportFilters>({
  startDate: props.modelValue.startDate,
  endDate: props.modelValue.endDate,
  branchIds: [...props.modelValue.branchIds],
  employeeId: props.modelValue.employeeId,
  paymentMethod: props.modelValue.paymentMethod,
  categoryIds: [...props.modelValue.categoryIds],
});

watch(
  () => props.modelValue,
  (nextValue) => {
    localFilters.startDate = nextValue.startDate;
    localFilters.endDate = nextValue.endDate;
    localFilters.branchIds = [...nextValue.branchIds];
    localFilters.employeeId = nextValue.employeeId;
    localFilters.paymentMethod = nextValue.paymentMethod;
    localFilters.categoryIds = [...nextValue.categoryIds];
  },
  { deep: true },
);

const applyFilters = () => {
  emit("update:modelValue", {
    startDate: localFilters.startDate,
    endDate: localFilters.endDate,
    branchIds: [...localFilters.branchIds],
    employeeId: localFilters.employeeId || null,
    paymentMethod: localFilters.paymentMethod,
    categoryIds: [...localFilters.categoryIds],
  });
  emit("apply");
};

const resetFilters = () => {
  emit("reset");
};
</script>

<template>
  <UCard class="rounded-2xl border border-white/60 bg-white/85 dark:border-slate-800 dark:bg-slate-900/80">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label class="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Desde</label>
        <UInput v-model="localFilters.startDate" type="date" />
      </div>

      <div>
        <label class="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Hasta</label>
        <UInput v-model="localFilters.endDate" type="date" />
      </div>

      <div v-if="showBranches">
        <label class="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Sucursal</label>
        <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <select v-model="localFilters.branchIds" multiple class="min-h-20 w-full bg-transparent outline-none">
            <option v-for="branch in branchOptions" :key="branch.value" :value="branch.value">
              {{ branch.label }}
            </option>
          </select>
        </div>
        <p v-if="branchHelp" class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {{ branchHelp }}
        </p>
      </div>

      <div v-if="showEmployees">
        <label class="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Empleado</label>
        <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <select v-model="localFilters.employeeId" class="w-full bg-transparent outline-none">
            <option value="">Todos</option>
            <option v-for="employee in employeeOptions" :key="employee.value" :value="employee.value">
              {{ employee.label }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-3">
      <UButton icon="i-lucide-filter" :loading="loading" @click="applyFilters">
        Aplicar
      </UButton>
      <UButton color="neutral" variant="soft" icon="i-lucide-rotate-ccw" :disabled="loading" @click="resetFilters">
        Reiniciar
      </UButton>
      <UButton color="success" variant="soft" icon="i-lucide-file-spreadsheet" :disabled="loading" @click="emit('export:csv')">
        CSV
      </UButton>
      <UButton color="neutral" variant="soft" icon="i-lucide-printer" :disabled="loading" @click="emit('export:pdf')">
        PDF
      </UButton>
    </div>
  </UCard>
</template>
