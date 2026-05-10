<script setup lang="ts">
import { z } from "zod";

import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

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

const state = reactive({
  branchIds: [] as string[],
  primaryBranchId: null as string | null,
});

const schema = z.object({
  branchIds: z.array(z.string()).min(1, "Selecciona al menos una sucursal."),
  primaryBranchId: z.string().nullable(),
}).superRefine((value, context) => {
  if (!value.primaryBranchId || !value.branchIds.includes(value.primaryBranchId)) {
    context.addIssue({
      code: "custom",
      path: ["primaryBranchId"],
      message: "Selecciona una sucursal primaria válida.",
    });
  }
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    state.branchIds = [...props.selectedBranchIds];
    state.primaryBranchId = props.primaryBranchId;
  },
  { immediate: true },
);

const availablePrimaryBranches = computed(() => {
  return props.branches.filter((branch) => state.branchIds.includes(branch.value));
});

const primaryBranchModel = computed<string | undefined>({
  get: () => state.primaryBranchId ?? undefined,
  set: (value) => {
    state.primaryBranchId = value ?? null;
  },
});

const toggleBranch = (branchId: string, checked: boolean) => {
  if (checked) {
    if (!state.branchIds.includes(branchId)) {
      state.branchIds = [...state.branchIds, branchId];
    }

    state.primaryBranchId ??= branchId;
    return;
  }

  state.branchIds = state.branchIds.filter((current) => current !== branchId);
  if (state.primaryBranchId === branchId) {
    state.primaryBranchId = state.branchIds[0] ?? null;
  }
};

const handleSave = () => {
  emits("save", {
    branchIds: [...state.branchIds],
    primaryBranchId: state.primaryBranchId,
  });
  emits("update:open", false);
};
</script>

<template>
  <UModal
    :open="open"
    title="Asignar sucursales"
    description="Define las sucursales visibles para el empleado."
    :ui="{ content: 'max-w-4xl' }"
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="handleSave">
        <AdminFormSection
          title="Sucursales asignadas"
          description="Marca las sucursales a las que podrá acceder el usuario y define una primaria."
          :columns="1"
        >
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
                  :model-value="state.branchIds.includes(branch.value)"
                  @update:model-value="toggleBranch(branch.value, Boolean($event))"
                />
              </div>
            </div>
          </div>

          <UFormField v-if="state.branchIds.length > 0" label="Sucursal primaria" name="primaryBranchId">
            <USelect
              v-model="primaryBranchModel"
              :items="availablePrimaryBranches"
              label-key="label"
              value-key="value"
              placeholder="Selecciona una sucursal primaria"
              class="w-full"
              :ui="ADMIN_FIELD_UI"
            />
          </UFormField>

          <UAlert
            v-else
            color="warning"
            variant="soft"
            icon="i-lucide-circle-alert"
            title="Sin sucursales seleccionadas"
            description="Selecciona al menos una sucursal si el usuario será empleado."
          />
        </AdminFormSection>
      </UForm>
    </template>

    <template #footer>
      <AdminFormActions>
        <UButton color="neutral" variant="ghost" @click="emits('update:open', false)">
          Cancelar
        </UButton>
        <UButton color="primary" @click="handleSave">
          Guardar asignaciones
        </UButton>
      </AdminFormActions>
    </template>
  </UModal>
</template>
