<script setup lang="ts">
defineProps<{
  eyebrow: string;
  title: string;
  description?: string;
  surface?: boolean;
}>();
</script>

<template>
  <section
    :class="surface
      ? 'rounded-[2rem] border border-slate-200/80 bg-gradient-to-br from-white via-white to-sky-50/60 px-4 py-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:shadow-black/20 sm:px-6 md:py-6'
      : ''"
  >
    <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-2.5">
        <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-600 dark:text-sky-300">
          {{ eyebrow }}
        </p>
        <h1 class="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
          {{ title }}
        </h1>
        <p v-if="description" class="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400 sm:text-base">
          {{ description }}
        </p>
      </div>

      <div v-if="$slots.actions || $slots.meta" class="flex flex-col gap-3 lg:max-w-[32rem] lg:items-end">
        <slot name="meta" />
        <div v-if="$slots.actions" class="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </section>
</template>
