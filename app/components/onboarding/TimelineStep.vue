<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  state: "completed" | "active" | "pending";
  icon?: string;
}>();
</script>

<template>
  <div
    class="flex items-start gap-3 rounded-[1.5rem] border border-slate-200/80 px-4 py-4 transition dark:border-slate-800 sm:gap-4"
    :class="state === 'pending' ? 'opacity-60' : ''"
  >
    <div
      class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
      :class="state === 'completed'
        ? 'bg-emerald-500 text-white'
        : state === 'active'
          ? 'bg-amber-500 text-white'
          : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'"
    >
      <UIcon
        :name="icon ?? (state === 'completed' ? 'i-lucide-check' : state === 'active' ? 'i-lucide-loader-circle' : 'i-lucide-lock')"
        class="h-5 w-5"
        :class="state === 'active' ? 'animate-spin' : ''"
      />
    </div>

    <div class="min-w-0 flex-1">
      <p class="text-base font-medium text-slate-950 dark:text-white">{{ title }}</p>
      <p class="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{{ description }}</p>
    </div>
  </div>
</template>
