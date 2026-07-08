<script setup lang="ts">
export type ReservationsTab = "summary" | "list";

const props = defineProps<{
  modelValue: ReservationsTab;
}>();

const emit = defineEmits<{
  "update:modelValue": [ReservationsTab];
}>();

const setTab = (tab: ReservationsTab) => {
  emit("update:modelValue", tab);
};
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <UButton
      :variant="props.modelValue === 'summary' ? 'solid' : 'soft'"
      :color="props.modelValue === 'summary' ? 'primary' : 'neutral'"
      class="rounded-2xl"
      @click="setTab('summary')"
    >
      Habitaciones
    </UButton>
    <UButton
      :variant="props.modelValue === 'list' ? 'solid' : 'soft'"
      :color="props.modelValue === 'list' ? 'primary' : 'neutral'"
      class="rounded-2xl"
      @click="setTab('list')"
    >
      Historial
    </UButton>
  </div>
</template>
