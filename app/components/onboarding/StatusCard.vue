<script setup lang="ts">
defineProps<{
  title: string;
  icon: string;
  tone: "success" | "error";
  items: string[];
}>();
</script>

<template>
  <div
    class="rounded-[1.5rem] p-4 sm:p-5"
    :class="tone === 'success'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'
      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300'"
  >
    <h3 class="mb-3 flex items-center gap-2 font-semibold">
      <UIcon :name="icon" class="h-5 w-5" />
      <span>{{ title }}</span>
    </h3>

    <ul class="space-y-2 text-sm leading-6">
      <li v-for="item in items" :key="item" class="flex items-start gap-2">
        <span class="mt-1 h-1.5 w-1.5 rounded-full bg-current" />
        <span>{{ item }}</span>
      </li>
    </ul>
  </div>
</template>
