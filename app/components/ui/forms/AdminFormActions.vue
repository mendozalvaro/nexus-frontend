<script setup lang="ts">
withDefaults(defineProps<{
  align?: "start" | "between" | "end";
}>(), {
  align: "end",
});
</script>

<template>
  <div
    :class="[
      'flex flex-col-reverse gap-3 sm:flex-row sm:items-center',
      align === 'start' && 'sm:justify-start',
      align === 'between' && 'sm:justify-between',
      align === 'end' && 'sm:justify-end',
    ]"
  >
    <slot />
  </div>
</template>
