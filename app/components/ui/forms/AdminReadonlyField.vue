<script setup lang="ts">
withDefaults(defineProps<{
  label: string;
  value?: string | number | null;
  placeholder?: string;
  name?: string;
}>(), {
  value: null,
  placeholder: "Sin datos",
  name: undefined,
});
</script>

<template>
  <div class="space-y-1.5">
    <label
      v-if="name"
      :for="name"
      class="block text-sm font-medium text-slate-700 dark:text-slate-300"
    >
      {{ label }}
    </label>
    <span
      v-else
      class="block text-sm font-medium text-slate-700 dark:text-slate-300"
    >
      {{ label }}
    </span>
    <div
      :id="name"
      class="admin-input-shell flex min-h-11 items-center rounded-[calc(var(--ui-radius)*1.5)] px-3 text-sm text-slate-500 dark:text-slate-400"
    >
      {{ value ?? placeholder }}
    </div>
  </div>
</template>
