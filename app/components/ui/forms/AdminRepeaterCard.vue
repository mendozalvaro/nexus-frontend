<script setup lang="ts">
defineProps<{
  title?: string;
  description?: string;
}>();
</script>

<template>
  <div class="admin-shell-panel-muted rounded-2xl p-4">
    <div v-if="$slots.header || title || description || $slots.actions" class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <slot name="header">
        <div v-if="title || description">
          <h4 v-if="title" class="text-sm font-semibold text-slate-900 dark:text-white">
            {{ title }}
          </h4>
          <p v-if="description" class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ description }}
          </p>
        </div>
      </slot>

      <div v-if="$slots.actions" class="shrink-0">
        <slot name="actions" />
      </div>
    </div>

    <slot />
  </div>
</template>
