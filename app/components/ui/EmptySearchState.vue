<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  icon?: string;
}>();
</script>

<template>
  <div class="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/80 p-5 text-center dark:border-slate-700 dark:bg-slate-900/60 md:p-6">
    <div
      v-if="icon"
      class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm dark:bg-slate-950 dark:text-slate-300"
    >
      <UIcon :name="icon" class="h-6 w-6" />
    </div>

    <h3 class="mt-4 text-base font-semibold text-slate-900 dark:text-white">
      {{ title }}
    </h3>
    <p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
      {{ description }}
    </p>

    <div v-if="$slots.actions" class="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
      <slot name="actions" />
    </div>
  </div>
</template>
