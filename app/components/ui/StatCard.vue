<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  icon: string;
  iconClass: string;
  iconWrapperClass: string;
}>();
</script>

<template>
  <UCard class="rounded-[24px] border-slate-200/80 shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:shadow-black/20">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 space-y-3">
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {{ label }}
        </p>
        <p class="truncate text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
          {{ value }}
        </p>
      </div>

      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" :class="iconWrapperClass">
        <UIcon :name="icon" class="h-6 w-6" :class="iconClass" />
      </div>
    </div>
  </UCard>
</template>
