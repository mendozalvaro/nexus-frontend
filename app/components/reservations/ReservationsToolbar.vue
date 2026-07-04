<script setup lang="ts">
const props = defineProps<{
  searchQuery: string;
  loading?: boolean;
  totalRows?: number;
}>();

const emit = defineEmits<{
  "update:searchQuery": [string];
  refresh: [];
  create: [];
}>();
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-end gap-2">
      <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" :loading="loading" @click="emit('refresh')">
        Actualizar
      </UButton>
      <UButton color="primary" icon="i-lucide-plus" @click="emit('create')">
        Nuevo ingreso
      </UButton>
    </div>

    <UiSearchFilters title="Buscar en historial" description="Filtra por huesped y combina el resultado con estado o fechas." surface>
      <template #controls>
        <UInput
          :model-value="searchQuery"
          icon="i-lucide-search"
          placeholder="Buscar huesped..."
          :ui="{ base: 'min-h-11 text-base' }"
          @update:model-value="emit('update:searchQuery', String($event ?? ''))"
        />
      </template>
      <template #summary>
        {{ props.totalRows ?? 0 }} estadia(s)
      </template>
    </UiSearchFilters>
  </div>
</template>
