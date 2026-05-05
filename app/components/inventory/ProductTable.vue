<script setup lang="ts">
import { h, resolveComponent } from "vue";
import type { InventoryProductRowView } from "@/utils/inventory";

const props = withDefaults(defineProps<{
  rows: InventoryProductRowView[];
  loading?: boolean;
  formatCurrency: (value: number) => string;
}>(), {
  loading: false,
});

const emits = defineEmits<{
  edit: [InventoryProductRowView];
}>();

const columns = computed(() => {
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) => row.original.name,
    },
    {
      accessorKey: "sku",
      header: "SKU",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) => row.original.sku ?? "--",
    },
    {
      accessorKey: "categoryName",
      header: "Categoria",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) => row.original.categoryName ?? "Sin categoria",
    },
    {
      accessorKey: "costPrice",
      header: "Costo",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) => props.formatCurrency(row.original.costPrice),
    },
    {
      accessorKey: "salePrice",
      header: "Venta",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) => props.formatCurrency(row.original.salePrice),
    },
    {
      accessorKey: "trackInventory",
      header: "Seguimiento",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) => row.original.trackInventory ? "SI" : "NO",
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) =>
        h(UButton, {
          size: "sm",
          color: "neutral",
          variant: "ghost",
          class: "min-h-9 justify-center",
          onClick: () => emits("edit", row.original),
        }, () => "Editar"),
    },
  ];
});
</script>

<template>
  <UiDataTable
    :data="rows"
    :columns="columns"
    :loading="loading"
    empty="No hay productos para mostrar."
    min-width-class="min-w-full rounded-[1.5rem]"
  />
</template>
