<script setup lang="ts">
export type ReportPeriod = "today" | "week" | "month" | "quarter" | "custom";

const props = defineProps<{
  modelValue: ReportPeriod;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: ReportPeriod];
  change: [period: ReportPeriod];
}>();

const periods: Array<{ key: ReportPeriod; label: string; icon: string }> = [
  { key: "today", label: "Hoy", icon: "i-lucide-sun" },
  { key: "week", label: "Semana", icon: "i-lucide-calendar-days" },
  { key: "month", label: "Mes", icon: "i-lucide-calendar" },
  { key: "quarter", label: "Trimestre", icon: "i-lucide-calendar-range" },
  { key: "custom", label: "Personalizado", icon: "i-lucide-settings-2" },
];

const selectPeriod = (period: ReportPeriod) => {
  emit("update:modelValue", period);
  emit("change", period);
};
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="period in periods"
      :key="period.key"
      type="button"
      class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
      :class="modelValue === period.key
        ? 'bg-primary-500 text-white shadow-sm'
        : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'"
      @click="selectPeriod(period.key)"
    >
      <UIcon :name="period.icon" class="h-4 w-4" />
      {{ period.label }}
    </button>
  </div>
</template>
