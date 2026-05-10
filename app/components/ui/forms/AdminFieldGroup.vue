<script setup lang="ts">
const props = withDefaults(defineProps<{
  columns?: 1 | 2 | 3 | 4;
  compact?: boolean;
}>(), {
  columns: 2,
  compact: false,
});

const columnsClass = computed(() => {
  switch (props.columns) {
    case 1:
      return "grid-cols-1";
    case 3:
      return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
    case 4:
      return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4";
    case 2:
    default:
      return "grid-cols-1 sm:grid-cols-2";
  }
});
</script>

<template>
  <div :class="['grid', columnsClass, compact ? 'gap-4' : 'gap-6']">
    <slot />
  </div>
</template>
