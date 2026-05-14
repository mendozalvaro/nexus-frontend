<script setup lang="ts">
const props = defineProps<{
  selectedDate: string;
  appointmentsCount: number;
}>();

const emits = defineEmits<{
  "update:selectedDate": [string];
  create: [];
}>();

const navigateDate = (delta: number) => {
  const current = new Date(`${props.selectedDate}T00:00:00`);
  current.setDate(current.getDate() + delta);
  const next = current.toISOString().slice(0, 10);
  emits("update:selectedDate", next);
};

const formatDateLabel = (dateStr: string): string => {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("es-BO", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

const summaryText = computed(() => {
  return `${props.appointmentsCount} cita${props.appointmentsCount !== 1 ? 's' : ''}`;
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-2">
        <UButton color="neutral" variant="soft" size="sm" icon="i-lucide-chevron-left" class="min-h-10 justify-center" @click="navigateDate(-1)">
          Anterior
        </UButton>
        <UButton color="neutral" variant="outline" size="sm" class="min-h-10 justify-center" @click="navigateDate(0)">
          Hoy
        </UButton>
        <UButton color="neutral" variant="soft" size="sm" icon="i-lucide-chevron-right" trailing class="min-h-10 justify-center" @click="navigateDate(1)">
          Siguiente
        </UButton>
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
          {{ formatDateLabel(selectedDate) }}
        </span>
      </div>

      <UButton color="primary" icon="i-lucide-plus" @click="emits('create')">
        Nueva cita
      </UButton>
    </div>

    <UiSearchFilters title="Citas del dia" :description="`${formatDateLabel(selectedDate)} · ${summaryText}`" surface>
      <template #summary>
        {{ summaryText }}
      </template>
    </UiSearchFilters>
  </div>
</template>
