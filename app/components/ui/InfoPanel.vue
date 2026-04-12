<script setup lang="ts">
defineProps<{
  eyebrow?: string;
  title: string;
  description?: string;
  roundedClass?: string;
}>();
</script>

<template>
  <UCard :class="roundedClass ?? 'rounded-[1.75rem]'">
    <template #header>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p v-if="eyebrow" class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            {{ eyebrow }}
          </p>
          <h2 class="text-lg font-semibold text-slate-950 dark:text-white" :class="eyebrow ? 'mt-2' : ''">
            {{ title }}
          </h2>
        </div>

        <p v-if="description" class="text-sm text-slate-500 dark:text-slate-400">
          {{ description }}
        </p>

        <slot name="header-actions" />
      </div>
    </template>

    <slot />
  </UCard>
</template>
