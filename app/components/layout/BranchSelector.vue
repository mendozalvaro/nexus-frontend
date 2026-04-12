<script setup lang="ts">
import type { AccessibleBranch } from "@/types/permissions";

const props = withDefaults(defineProps<{
  branches: AccessibleBranch[];
  modelValue: string | null;
  disabled?: boolean;
}>(), {
  disabled: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: string | null];
  change: [value: string | null];
}>();

const selectedBranch = computed(() =>
  props.branches.find((branch) => branch.id === props.modelValue) ?? null,
);

const branchItems = computed(() =>
  props.branches.map((branch) => ({
    ...branch,
    displayLabel: branch.address ? `${branch.name} - ${branch.address}` : branch.name,
  })),
);

const selectedBranchLabel = computed(() => {
  if (!selectedBranch.value) {
    return "Selecciona la sucursal operativa actual.";
  }

  return selectedBranch.value.address
    ? `${selectedBranch.value.name} - ${selectedBranch.value.address}`
    : selectedBranch.value.name;
});

const internalValue = computed({
  get: () => props.modelValue ?? undefined,
  set: (value: string | undefined) => {
    const normalizedValue = value ?? null;
    emit("update:modelValue", normalizedValue);
    emit("change", normalizedValue);
  },
});
</script>

<template>
  <div v-if="branches.length > 0" class="w-full min-w-0">
    <USelectMenu
      v-model="internalValue"
      :items="branchItems"
      value-key="id"
      label-key="displayLabel"
      :disabled="disabled"
      :search-input="{ placeholder: 'Buscar sucursal' }"
      searchable
      class="w-full"
      size="md"
      :placeholder="selectedBranchLabel"
    />
  </div>
</template>
