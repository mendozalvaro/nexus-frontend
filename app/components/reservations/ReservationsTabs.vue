<script setup lang="ts">
export type ReservationsTab = "summary" | "list";

const props = defineProps<{
  modelValue: ReservationsTab;
  summaryCount?: number;
  historyCount?: number;
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
      <UBadge v-if="typeof props.summaryCount === 'number'" color="neutral" variant="subtle" size="sm" class="ml-2">
        {{ props.summaryCount }}
      </UBadge>
    </UButton>
    <UButton
      :variant="props.modelValue === 'list' ? 'solid' : 'soft'"
      :color="props.modelValue === 'list' ? 'primary' : 'neutral'"
      class="rounded-2xl"
      @click="setTab('list')"
    >
      Historial
      <UBadge v-if="typeof props.historyCount === 'number'" color="neutral" variant="subtle" size="sm" class="ml-2">
        {{ props.historyCount }}
      </UBadge>
    </UButton>
  </div>
</template>
