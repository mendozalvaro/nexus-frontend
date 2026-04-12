<script setup lang="ts">
import type { UserBranchOption } from "@/composables/useUsers";

const props = defineProps<{
  open: boolean;
  branches: UserBranchOption[];
  selectedBranchIds: string[];
  primaryBranchId: string | null;
}>();

const emits = defineEmits<{
  "update:open": [boolean];
  save: [{ branchIds: string[]; primaryBranchId: string | null }];
}>();

const internalSelected = ref<string[]>([]);
const internalPrimary = ref<string | null>(null);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    internalSelected.value = [...props.selectedBranchIds];
    internalPrimary.value = props.primaryBranchId;
  },
  { immediate: true },
);

const toggleBranch = (branchId: string, checked: boolean) => {
  if (checked) {
    if (!internalSelected.value.includes(branchId)) {
      internalSelected.value = [...internalSelected.value, branchId];
    }

    internalPrimary.value ??= branchId;
    return;
  }

  internalSelected.value = internalSelected.value.filter((current) => current !== branchId);
  if (internalPrimary.value === branchId) {
    internalPrimary.value = internalSelected.value[0] ?? null;
  }
};

const handleSave = () => {
  emits("save", {
    branchIds: internalSelected.value,
    primaryBranchId: internalPrimary.value,
  });
  emits("update:open", false);
};
</script>

<template>
  <UModal :open="open" title="Asignar sucursales" description="Define las sucursales visibles para el empleado." @update:open="emits('update:open', $event)">
    <template #body>
      <div class="space-y-4">
        <div class="space-y-3">
          <div
            v-for="branch in branches"
            :key="branch.value"
            class="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800"
          >
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="font-medium text-slate-950 dark:text-white">
                  {{ branch.label }}
                </p>
              </div>

              <UCheckbox
                :model-value="internalSelected.includes(branch.value)"
                @update:model-value="toggleBranch(branch.value, Boolean($event))"
              />
            </div>
          </div>
        </div>

        <div v-if="internalSelected.length > 0">
          <label class="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Sucursal primaria
          </label>
          <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
            <select v-model="internalPrimary" class="w-full bg-transparent outline-none">
              <option v-for="branchId in internalSelected" :key="branchId" :value="branchId">
                {{ branches.find((branch) => branch.value === branchId)?.label ?? branchId }}
              </option>
            </select>
          </div>
        </div>

        <UAlert
          v-else
          color="warning"
          variant="soft"
          icon="i-lucide-circle-alert"
          title="Sin sucursales seleccionadas"
          description="Selecciona al menos una sucursal si el usuario será empleado."
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton color="neutral" variant="ghost" @click="emits('update:open', false)">
          Cancelar
        </UButton>
        <UButton color="primary" @click="handleSave">
          Guardar asignaciones
        </UButton>
      </div>
    </template>
  </UModal>
</template>
