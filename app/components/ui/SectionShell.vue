<script setup lang="ts">
defineProps<{
  eyebrow?: string;
  title: string;
  description?: string;
}>();
</script>

<template>
  <section class="space-y-4 rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-4 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-black/20 md:p-5">
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div class="min-w-0">
        <p v-if="eyebrow" class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          {{ eyebrow }}
        </p>
        <h2 class="text-lg font-semibold text-slate-950 dark:text-white" :class="eyebrow ? 'mt-1.5' : ''">
          {{ title }}
        </h2>
        <p v-if="description" class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ description }}
        </p>
      </div>

      <div v-if="$slots.actions" class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
        <slot name="actions" />
      </div>
    </div>

    <slot />
  </section>
</template>
