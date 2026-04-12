<script setup lang="ts">
interface KpiStripItem {
  label: string;
  value: string | number;
  icon?: string;
  tone?: "sky" | "emerald" | "amber" | "fuchsia" | "slate";
}

const props = withDefaults(defineProps<{
  items: readonly KpiStripItem[];
  columnsClass?: string;
}>(), {
  columnsClass: "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
});

const toneMap: Record<NonNullable<KpiStripItem["tone"]>, { wrapper: string; icon: string }> = {
  sky: {
    wrapper: "bg-sky-50 dark:bg-sky-950/40",
    icon: "text-sky-600 dark:text-sky-300",
  },
  emerald: {
    wrapper: "bg-emerald-50 dark:bg-emerald-950/40",
    icon: "text-emerald-600 dark:text-emerald-300",
  },
  amber: {
    wrapper: "bg-amber-50 dark:bg-amber-950/40",
    icon: "text-amber-600 dark:text-amber-300",
  },
  fuchsia: {
    wrapper: "bg-fuchsia-50 dark:bg-fuchsia-950/40",
    icon: "text-fuchsia-600 dark:text-fuchsia-300",
  },
  slate: {
    wrapper: "bg-slate-100 dark:bg-slate-800",
    icon: "text-slate-700 dark:text-slate-200",
  },
};

const resolvedItems = computed(() =>
  props.items.map((item) => {
    const tone = toneMap[item.tone ?? "slate"];

    return {
      ...item,
      iconWrapperClass: tone.wrapper,
      iconClass: tone.icon,
    };
  }),
);
</script>

<template>
  <section class="grid gap-4" :class="columnsClass">
    <UiStatCard
      v-for="item in resolvedItems"
      :key="item.label"
      :label="item.label"
      :value="item.value"
      :icon="item.icon || 'i-lucide-circle-dollar-sign'"
      :icon-wrapper-class="item.iconWrapperClass"
      :icon-class="item.iconClass"
    />
  </section>
</template>
