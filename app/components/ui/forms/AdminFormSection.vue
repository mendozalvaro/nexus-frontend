<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string;
  description?: string;
  badge?: string;
  columns?: 1 | 2 | 3 | 4;
  compact?: boolean;
}>(), {
  title: undefined,
  description: undefined,
  badge: undefined,
  columns: 2,
  compact: false,
});

const columnsClass = computed(() => {
  switch (props.columns) {
    case 1:
      return "grid-cols-1";
    case 3:
      return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
    case 4:
      return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4";
    case 2:
    default:
      return "grid-cols-1 sm:grid-cols-2";
  }
});
</script>

<template>
  <section>
    <div v-if="$slots.title || title || description || badge" class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <slot name="title">
        <div>
          <h3 v-if="title" class="admin-filter-label mb-0">
            {{ title }}
          </h3>
          <p v-if="description" class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {{ description }}
          </p>
        </div>
      </slot>

      <slot name="helper" />

      <div v-if="$slots.badge || badge" class="shrink-0">
        <slot name="badge">
          <UBadge size="xs" color="neutral" variant="subtle">
            {{ badge }}
          </UBadge>
        </slot>
      </div>
    </div>

    <div :class="['grid', columnsClass, compact ? 'gap-4' : 'gap-6']">
      <slot />
    </div>
  </section>
</template>
