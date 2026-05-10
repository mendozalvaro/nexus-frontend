<script setup lang="ts">
import BranchForm from "@/components/branches/forms/BranchForm.vue";

import type { BranchMutationPayload } from "@/composables/useBranches";

const props = withDefaults(defineProps<{
  open: boolean;
  mode: "create" | "edit";
  initialValue?: BranchMutationPayload;
  loading?: boolean;
  limitMessage?: string | null;
}>(), {
  loading: false,
  initialValue: undefined,
  limitMessage: null,
});

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [BranchMutationPayload];
  cancel: [];
}>();

const isEditing = computed(() => props.mode === "edit");
</script>

<template>
  <UModal
    :open="open"
    :title="isEditing ? 'Editar sucursal' : 'Nueva sucursal'"
    :description="isEditing ? 'Actualiza los datos de la sucursal.' : 'Crea una sucursal para tu organización.'"
    :ui="{ content: 'max-w-4xl' }"
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <BranchForm
        :mode="mode"
        :loading="loading"
        :initial-value="initialValue"
        :submit-label="isEditing ? 'Guardar cambios' : 'Crear sucursal'"
        :limit-message="isEditing ? null : limitMessage"
        @submit="emits('submit', $event)"
        @cancel="emits('cancel')"
      />
    </template>
  </UModal>
</template>
