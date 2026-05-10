<template>
  <div class="admin-shell-panel rounded-3xl p-6 md:p-8">
    <!-- Header -->
    <div class="mb-8 border-b border-slate-200/50 pb-5 dark:border-slate-800/50">
      <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
        {{ title }}
      </h2>
      <p
        v-if="description"
        class="mt-1 text-sm text-slate-500 dark:text-slate-400"
      >
        {{ description }}
      </p>
    </div>

    <!-- Body -->
    <div class="space-y-8">
      <slot />
    </div>

    <!-- Footer -->
    <div
      v-if="$slots.footer"
      class="mt-8 flex items-center justify-end gap-3 border-t border-slate-200/50 pt-6 dark:border-slate-800/50"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string;
  description?: string;
}

defineProps<Props>();
</script>
