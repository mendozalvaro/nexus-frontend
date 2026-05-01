<script setup lang="ts">
import type { InventoryProductRowView } from "@/composables/useInventory";

const props = withDefaults(defineProps<{
  rows: InventoryProductRowView[];
  loading?: boolean;
  showBranches?: boolean;
  activeBranchIds?: string[];
}>(), {
  loading: false,
  showBranches: false,
  activeBranchIds: () => [],
});

const effectiveBranchIds = computed(() => new Set(props.activeBranchIds));

const groupedRows = computed(() => {
  const groups = new Map<string, { categoryName: string; rows: InventoryProductRowView[] }>();

  for (const row of props.rows) {
    const categoryName = row.categoryName?.trim() || "Sin categoria";
    const bucket = groups.get(categoryName);
    if (bucket) {
      bucket.rows.push(row);
      continue;
    }

    groups.set(categoryName, {
      categoryName,
      rows: [row],
    });
  }

  return Array.from(groups.values())
    .sort((left, right) => left.categoryName.localeCompare(right.categoryName, "es"))
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((left, right) => left.name.localeCompare(right.name, "es")),
    }));
});

const getVisibleBranchStock = (row: InventoryProductRowView) => {
  if (effectiveBranchIds.value.size === 0) {
    return row.stockByBranch;
  }

  return row.stockByBranch.filter((item) => effectiveBranchIds.value.has(item.branchId));
};

const openState = ref<Record<string, boolean>>({});

watch(
  groupedRows,
  (groups) => {
    const nextState: Record<string, boolean> = {};
    for (const group of groups) {
      nextState[group.categoryName] = openState.value[group.categoryName] ?? true;
    }
    openState.value = nextState;
  },
  { immediate: true },
);

const toggleCategory = (categoryName: string) => {
  openState.value[categoryName] = !openState.value[categoryName];
};
</script>

<template>
  <div class="space-y-4">
    <USkeleton v-if="loading" class="h-24 w-full rounded-2xl" />

    <UCard
      v-for="group in groupedRows"
      :key="group.categoryName"
      class="rounded-[1.25rem] border-slate-200/80 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:shadow-black/20"
    >
      <template #header>
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 text-left"
          @click="toggleCategory(group.categoryName)"
        >
          <div>
            <p class="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Categoria
            </p>
            <h3 class="text-base font-semibold text-slate-950 dark:text-white">
              {{ group.categoryName }}
            </h3>
          </div>
          <div class="flex items-center gap-2">
            <UBadge color="neutral" variant="soft">
              {{ group.rows.length }} producto(s)
            </UBadge>
            <UIcon :name="openState[group.categoryName] ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="text-slate-500" />
          </div>
        </button>
      </template>

      <div v-if="openState[group.categoryName]" class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th class="px-2 py-2">Producto y SKU</th>
              <th class="px-2 py-2">Disponible</th>
              <th v-if="showBranches" class="px-2 py-2">Sucursales</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in group.rows" :key="row.id" class="border-b border-slate-100 last:border-b-0 dark:border-slate-800/70">
              <td class="px-2 py-2 align-top">
                <p class="font-medium text-slate-950 dark:text-white">
                  {{ row.name }}
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ row.sku || "Sin SKU" }}
                </p>
              </td>
              <td class="px-2 py-2 align-top">
                <p class="font-medium text-slate-900 dark:text-slate-100">
                  {{ row.totalAvailableQuantity }}
                </p>
              </td>
              <td v-if="showBranches" class="px-2 py-2 align-top">
                <div class="flex flex-wrap gap-1.5">
                  <UBadge
                    v-for="stock in getVisibleBranchStock(row)"
                    :key="`${row.id}:${stock.branchId}`"
                    :color="stock.isLowStock ? 'warning' : 'neutral'"
                    variant="soft"
                    class="rounded-full"
                  >
                    {{ stock.branchCode }}: {{ stock.availableQuantity }}
                  </UBadge>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UAlert
      v-if="!loading && groupedRows.length === 0"
      color="neutral"
      variant="soft"
      icon="i-lucide-package-search"
      title="Sin productos"
      description="No hay productos para mostrar en este filtro."
    />
  </div>
</template>
