<script setup lang="ts">
export type CustomersTab = "summary" | "customers";

const props = defineProps<{
  modelValue: CustomersTab;
}>();

const emits = defineEmits<{
  "update:modelValue": [CustomersTab];
}>();

const setTab = (tab: CustomersTab) => {
  emits("update:modelValue", tab);
};
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <UButton :variant="props.modelValue === 'summary' ? 'solid' : 'soft'" :color="props.modelValue === 'summary' ? 'primary' : 'neutral'" @click="setTab('summary')">
      Resumen
    </UButton>
    <UButton :variant="props.modelValue === 'customers' ? 'solid' : 'soft'" :color="props.modelValue === 'customers' ? 'primary' : 'neutral'" @click="setTab('customers')">
      Cartera
    </UButton>
  </div>
</template>
