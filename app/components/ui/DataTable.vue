<script setup lang="ts">
const props = defineProps<{
  data: unknown[];
  columns: unknown[];
  loading?: boolean;
  empty?: string;
  minWidthClass?: string;
  page?: number;
  pageCount?: number;
  pageLabel?: string;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
}>();

defineEmits<{
  previous: [];
  next: [];
}>();

const tableData = computed(() => props.data as never);
const tableColumns = computed(() => props.columns as never);
</script>

<template>
  <div class="space-y-4">
    <div class="overflow-x-auto">
      <UTable
        :data="tableData"
        :columns="tableColumns"
        :loading="loading"
        :empty="empty"
        :class="minWidthClass ?? 'min-w-full rounded-[1.5rem]'"
      />
    </div>

    <div v-if="page && pageCount" class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        {{ pageLabel ?? `Pagina ${page} de ${pageCount}` }}
      </p>

      <div class="grid grid-cols-2 gap-2 sm:flex">
        <UButton color="neutral" variant="soft" size="sm" class="min-h-10 justify-center" :disabled="previousDisabled" @click="$emit('previous')">
          Anterior
        </UButton>
        <UButton color="neutral" variant="soft" size="sm" class="min-h-10 justify-center" :disabled="nextDisabled" @click="$emit('next')">
          Siguiente
        </UButton>
      </div>
    </div>
  </div>
</template>
