<script setup lang="ts">
import type { ReservationFilters, ReservationListItem } from "@/composables/useReservations";

defineProps<{
  filters: ReservationFilters;
  statusFilterOptions: Array<{ label: string; value: string }>;
  loading: boolean;
  rows: ReservationListItem[];
  columns: unknown[];
}>();

const emit = defineEmits<{
  clear: [];
  apply: [];
}>();
</script>

<template>
  <div class="space-y-6">
    <UiSearchFilters title="Filtrar historial" description="Busca y filtra por estado y rango de fechas." surface>
      <template #controls>
        <div class="grid grid-cols-1 gap-3 xl:grid-cols-5">
          <UInput v-model="filters.search" icon="i-lucide-search" placeholder="Buscar huesped..." class="xl:col-span-2" :ui="{ base: 'min-h-11 text-base' }" />
          <USelect v-model="filters.status" :items="statusFilterOptions" label-key="label" value-key="value" placeholder="Filtrar por estado" class="w-full" />
          <UInput v-model="filters.fromDate" type="date" placeholder="Desde" class="w-full" />
          <UInput v-model="filters.toDate" type="date" placeholder="Hasta" class="w-full" />
        </div>
      </template>

      <template #actions>
        <div class="flex gap-2">
          <UButton color="neutral" variant="soft" @click="emit('clear')">Limpiar</UButton>
          <UButton color="primary" variant="soft" :loading="loading" @click="emit('apply')">Aplicar</UButton>
        </div>
      </template>
    </UiSearchFilters>

    <div class="overflow-x-auto rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-2 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
      <UiDataTable :data="rows" :columns="columns" :loading="loading" />
    </div>
  </div>
</template>
