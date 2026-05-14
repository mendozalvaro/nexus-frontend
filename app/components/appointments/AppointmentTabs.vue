<script setup lang="ts">
export type AppointmentTab = "resumen" | "citas";

const props = defineProps<{
  modelValue: AppointmentTab;
}>();

const emits = defineEmits<{
  "update:modelValue": [AppointmentTab];
}>();

const setTab = (tab: AppointmentTab) => {
  emits("update:modelValue", tab);
};
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <UButton :variant="props.modelValue === 'resumen' ? 'solid' : 'soft'" :color="props.modelValue === 'resumen' ? 'primary' : 'neutral'" @click="setTab('resumen')">
      Resumen
    </UButton>
    <UButton :variant="props.modelValue === 'citas' ? 'solid' : 'soft'" :color="props.modelValue === 'citas' ? 'primary' : 'neutral'" @click="setTab('citas')">
      Citas
    </UButton>
  </div>
</template>
