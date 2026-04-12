<script setup lang="ts">
import { h, resolveComponent } from "vue";

import type { InventoryProductRowView } from "@/composables/useInventory";

const props = withDefaults(defineProps<{
  rows: InventoryProductRowView[];
  loading?: boolean;
}>(), {
  loading: false,
});

const emits = defineEmits<{
  move: [InventoryProductRowView];
}>();

const columns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "name",
      header: "Producto",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) =>
        h("div", { class: "min-w-0 space-y-1" }, [
          h("p", { class: "truncate font-medium text-slate-950 dark:text-white" }, row.original.name),
          h("p", { class: "truncate text-xs text-slate-500 dark:text-slate-400" }, row.original.sku ?? "Sin SKU"),
        ]),
    },
    {
      accessorKey: "categoryName",
      header: "Categoria",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, row.original.categoryName ?? "Sin categoria"),
    },
    {
      accessorKey: "totalAvailableQuantity",
      header: "Disponible",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) =>
        h("div", { class: "space-y-1" }, [
          h("p", { class: "font-medium text-slate-950 dark:text-white" }, `${row.original.totalAvailableQuantity} unid.`),
          h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, `Total fisico: ${row.original.totalQuantity}`),
        ]),
    },
    {
      accessorKey: "stockByBranch",
      header: "Sucursales",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) =>
        h("div", { class: "flex min-w-[12rem] flex-wrap gap-1.5" }, row.original.stockByBranch.slice(0, 4).map((stock) =>
          h(
            UBadge,
            {
              color: stock.isLowStock ? "warning" : "neutral",
              variant: "soft",
              class: "rounded-full",
            },
            () => `${stock.branchCode}: ${stock.availableQuantity}`,
          ),
        )),
    },
    {
      accessorKey: "lowStockBranchesCount",
      header: "Alertas",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) =>
        h(UBadge, {
          color: row.original.lowStockBranchesCount > 0 ? "warning" : "success",
          variant: "soft",
        }, () => row.original.lowStockBranchesCount > 0 ? `${row.original.lowStockBranchesCount} alerta(s)` : "Sin alertas"),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) =>
        h(UButton, {
          color: "primary",
          variant: "soft",
          size: "sm",
          class: "min-h-10 justify-center",
          onClick: () => emits("move", row.original),
        }, () => "Registrar movimiento"),
    },
  ];
});
</script>

<template>
  <UiDataTable
    :data="rows"
    :columns="columns"
    :loading="loading"
    empty="No hay productos para operar en inventario."
    min-width-class="min-w-[64rem] rounded-[1.5rem]"
  />
</template>
