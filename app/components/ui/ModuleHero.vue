<script setup lang="ts">
defineProps<{
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: string;
}>();
</script>

<template>
  <section class="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-gradient-to-br from-white via-sky-50/70 to-slate-50 p-5 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:shadow-black/20 md:p-6">
    <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <p v-if="eyebrow" class="text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-600 dark:text-sky-300">
          {{ eyebrow }}
        </p>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-3xl">
          {{ title }}
        </h1>
        <p v-if="description" class="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 md:text-base">
          {{ description }}
        </p>
      </div>

      <div class="flex items-center justify-between gap-4 lg:flex-col lg:items-end">
        <div
          v-if="icon"
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.5rem] border border-white/70 bg-white/90 text-sky-600 shadow-sm shadow-sky-100 dark:border-slate-800 dark:bg-slate-900/80 dark:text-sky-300 dark:shadow-black/20"
        >
          <UIcon :name="icon" class="h-7 w-7" />
        </div>

        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </section>
</template>
