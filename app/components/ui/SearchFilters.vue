<script setup lang="ts">
defineProps<{
  title?: string;
  description?: string;
  surface?: boolean;
}>();
</script>

<template>
  <div
    :class="surface
      ? 'space-y-4 rounded-[1.75rem] border border-white/60 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-900/80'
      : 'space-y-4'"
  >
    <div v-if="title || description" class="space-y-1">
      <p v-if="title" class="text-sm font-semibold text-slate-900 dark:text-white">
        {{ title }}
      </p>
      <p v-if="description" class="text-sm text-slate-500 dark:text-slate-400">
        {{ description }}
      </p>
    </div>

    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div class="min-w-0 flex-1">
        <slot name="controls" />
      </div>

      <div class="shrink-0 text-sm text-slate-500 dark:text-slate-400 lg:text-right">
        <slot name="summary" />
      </div>
    </div>
  </div>
</template>
