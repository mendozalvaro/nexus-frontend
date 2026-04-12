<script setup lang="ts">
interface ActivityItem {
  title: string;
  time: string;
  icon: string;
  iconWrapperClass: string;
  iconClass: string;
}

defineProps<{
  items: readonly ActivityItem[];
}>();
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="item in items"
      :key="`${item.title}-${item.time}`"
      class="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
    >
      <div class="flex h-11 w-11 items-center justify-center rounded-2xl" :class="item.iconWrapperClass">
        <UIcon :name="item.icon" class="h-5 w-5" :class="item.iconClass" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="font-medium text-slate-900 dark:text-white">
          {{ item.title }}
        </p>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ item.time }}
        </p>
      </div>
    </div>
  </div>
</template>
