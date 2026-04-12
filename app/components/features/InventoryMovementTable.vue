<script setup lang="ts">
import { h, resolveComponent } from "vue";

import type { InventoryMovementRowView } from "@/composables/useInventory";

const props = withDefaults(defineProps<{
  rows: InventoryMovementRowView[];
  loading?: boolean;
  formatDateTime: (value: string | null) => string;
  getMovementLabel: (value: InventoryMovementRowView["movementType"]) => string;
  getMovementColor: (value: InventoryMovementRowView["movementType"]) => "success" | "warning" | "error" | "primary" | "neutral";
}>(), {
  loading: false,
});

const columns = computed(() => {
  const UBadge = resolveComponent("UBadge");

  return [
    {
      accessorKey: "createdAt",
      header: "Fecha",
      cell: ({ row }: { row: { original: InventoryMovementRowView } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, props.formatDateTime(row.original.createdAt)),
    },
    {
      accessorKey: "productName",
      header: "Producto",
      cell: ({ row }: { row: { original: InventoryMovementRowView } }) =>
        h("div", { class: "space-y-1" }, [
          h("p", { class: "font-medium text-slate-950 dark:text-white" }, row.original.productName),
          h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, row.original.sku ?? "Sin SKU"),
        ]),
    },
    {
      accessorKey: "branchName",
      header: "Sucursal",
      cell: ({ row }: { row: { original: InventoryMovementRowView } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, `${row.original.branchName} (${row.original.branchCode})`),
    },
    {
      accessorKey: "movementType",
      header: "Tipo",
      cell: ({ row }: { row: { original: InventoryMovementRowView } }) =>
        h(UBadge, {
          color: props.getMovementColor(row.original.movementType),
          variant: "soft",
        }, () => props.getMovementLabel(row.original.movementType)),
    },
    {
      accessorKey: "quantity",
      header: "Cantidad",
      cell: ({ row }: { row: { original: InventoryMovementRowView } }) =>
        h("span", { class: "text-sm font-medium text-slate-950 dark:text-white" }, String(row.original.quantity)),
    },
    {
      accessorKey: "newQuantity",
      header: "Stock final",
      cell: ({ row }: { row: { original: InventoryMovementRowView } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, `${row.original.previousQuantity} -> ${row.original.newQuantity}`),
    },
    {
      accessorKey: "createdByName",
      header: "Usuario",
      cell: ({ row }: { row: { original: InventoryMovementRowView } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, row.original.createdByName ?? "Sistema"),
    },
  ];
});
</script>

<template>
  <UiDataTable
    :data="rows"
    :columns="columns"
    :loading="loading"
    empty="No hay movimientos para mostrar."
    min-width-class="min-w-[72rem] rounded-[1.5rem]"
  />
</template>
