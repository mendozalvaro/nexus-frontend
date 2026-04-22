<script setup lang="ts">
export type BranchesTabKey = "summary" | "branches";

const props = defineProps<{
  modelValue: BranchesTabKey;
}>();

const emits = defineEmits<{
  "update:modelValue": [BranchesTabKey];
}>();
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <UButton
      :variant="props.modelValue === 'summary' ? 'solid' : 'soft'"
      :color="props.modelValue === 'summary' ? 'primary' : 'neutral'"
      @click="emits('update:modelValue', 'summary')"
    >
      Resumen
    </UButton>
    <UButton
      :variant="props.modelValue === 'branches' ? 'solid' : 'soft'"
      :color="props.modelValue === 'branches' ? 'primary' : 'neutral'"
      @click="emits('update:modelValue', 'branches')"
    >
      Sucursales
    </UButton>
  </div>
</template>
