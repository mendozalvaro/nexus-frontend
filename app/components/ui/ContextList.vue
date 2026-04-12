<script setup lang="ts">
interface ContextItem {
  label: string;
  value: string | number;
}

defineProps<{
  items: ContextItem[];
}>();
</script>

<template>
  <div class="space-y-2 text-sm text-slate-600 dark:text-slate-300">
    <p v-for="item in items" :key="item.label">
      <span class="font-medium text-slate-950 dark:text-white">{{ item.label }}:</span>
      {{ item.value }}
    </p>
  </div>
</template>
