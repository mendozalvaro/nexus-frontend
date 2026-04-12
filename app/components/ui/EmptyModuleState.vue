<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  icon?: string;
}>();
</script>

<template>
  <UCard class="rounded-[1.75rem] border-slate-200/80 shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:shadow-black/20">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300">
        <UIcon :name="icon ?? 'i-lucide-sparkles'" class="h-6 w-6" />
      </div>

      <div class="min-w-0 space-y-2">
        <h2 class="text-lg font-semibold text-slate-950 dark:text-white">
          {{ title }}
        </h2>
        <p class="text-sm leading-6 text-slate-600 dark:text-slate-400 md:text-base">
          {{ description }}
        </p>
        <div v-if="$slots.actions" class="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </UCard>
</template>
