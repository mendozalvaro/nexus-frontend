<script setup lang="ts">
const props = withDefaults(defineProps<{
  tone?: "neutral" | "warning" | "error" | "success";
  icon?: string;
}>(), {
  tone: "neutral",
  icon: undefined,
});

const toneClass = computed(() => {
  switch (props.tone) {
    case "warning":
      return "text-orange-600 dark:text-orange-400";
    case "error":
      return "text-rose-600 dark:text-rose-400";
    case "success":
      return "text-emerald-600 dark:text-emerald-400";
    case "neutral":
    default:
      return "text-slate-500 dark:text-slate-400";
  }
});
</script>

<template>
  <p :class="['mt-2 flex items-start gap-2 text-xs', toneClass]">
    <UIcon v-if="icon" :name="icon" class="mt-0.5 h-4 w-4 shrink-0" />
    <span>
      <slot />
    </span>
  </p>
</template>
