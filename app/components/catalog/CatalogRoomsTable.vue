<script setup lang="ts">
import { h, resolveComponent } from "vue";
import type { CatalogRoomItem } from "@/composables/useCatalog";

const props = defineProps<{
  rows: CatalogRoomItem[];
  loading?: boolean;
}>();

const emits = defineEmits<{
  edit: [CatalogRoomItem];
  "toggle-status": [{ id: string; nextState: boolean }];
}>();

const columns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "roomNumber",
      header: "Habitacion",
      cell: ({ row }: { row: { original: CatalogRoomItem } }) =>
        h("div", { class: "space-y-1" }, [
          h("p", { class: "font-medium text-slate-950 dark:text-white" }, row.original.roomNumber),
          h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, row.original.location || "-"),
        ]),
    },
    {
      accessorKey: "categoryName",
      header: "Categoria",
      cell: ({ row }: { row: { original: CatalogRoomItem } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, row.original.categoryName ?? "Sin categoria"),
    },
    {
      accessorKey: "branchName",
      header: "Sucursal",
      cell: ({ row }: { row: { original: CatalogRoomItem } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, row.original.branchName),
    },
    {
      accessorKey: "basePrice",
      header: "Precio fijo",
      cell: ({ row }: { row: { original: CatalogRoomItem } }) =>
        h("span", { class: "font-medium text-slate-700 dark:text-slate-200" }, `$${Number(row.original.basePrice ?? 0).toFixed(2)}`),
    },
    {
      accessorKey: "isActive",
      header: "Estado",
      cell: ({ row }: { row: { original: CatalogRoomItem } }) =>
        h(UBadge, { color: row.original.isActive ? "success" : "neutral", variant: "soft" }, () => row.original.isActive ? "Activo" : "Inactivo"),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: CatalogRoomItem } }) =>
        h("div", { class: "flex flex-col gap-2 sm:flex-row" }, [
          h(UButton, {
            size: "sm",
            color: "neutral",
            variant: "ghost",
            class: "min-h-10",
            onClick: () => emits("edit", row.original),
          }, () => "Editar"),
          h(UButton, {
            size: "sm",
            color: row.original.isActive ? "error" : "success",
            variant: "ghost",
            class: "min-h-10",
            onClick: () => emits("toggle-status", { id: row.original.id, nextState: !row.original.isActive }),
          }, () => row.original.isActive ? "Desactivar" : "Activar"),
        ]),
    },
  ];
});
</script>

<template>
  <UiDataTable
    :data="props.rows"
    :columns="columns"
    :loading="props.loading ?? false"
    empty="No hay habitaciones en el catalogo."
    min-width-class="min-w-[66rem] rounded-[1.5rem]"
  />
</template>
