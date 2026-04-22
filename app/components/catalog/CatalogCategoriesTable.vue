<script setup lang="ts">
import { h, resolveComponent } from "vue";

import type { CatalogCategoryItem } from "@/composables/useCatalog";

const props = defineProps<{
  rows: CatalogCategoryItem[];
  loading?: boolean;
}>();

const emits = defineEmits<{
  edit: [CatalogCategoryItem];
  "toggle-status": [{ id: string; nextState: boolean }];
}>();

const columns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "name",
      header: "Categoria",
      cell: ({ row }: { row: { original: CatalogCategoryItem } }) =>
        h("div", { class: "space-y-1" }, [
          h("p", { class: "font-medium text-slate-950 dark:text-white" }, row.original.name),
          h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, row.original.parentName ?? "Sin categoria padre"),
        ]),
    },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }: { row: { original: CatalogCategoryItem } }) =>
        h(UBadge, { color: row.original.type === "product" ? "primary" : "warning", variant: "soft" }, () => row.original.type === "product" ? "Producto" : "Servicio"),
    },
    {
      accessorKey: "linkedCount",
      header: "Elementos",
      cell: ({ row }: { row: { original: CatalogCategoryItem } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, `${row.original.linkedCount}`),
    },
    {
      accessorKey: "isActive",
      header: "Estado",
      cell: ({ row }: { row: { original: CatalogCategoryItem } }) =>
        h(UBadge, { color: row.original.isActive ? "success" : "neutral", variant: "soft" }, () => row.original.isActive ? "Activa" : "Inactiva"),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: CatalogCategoryItem } }) =>
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
    empty="No hay categorias en el catalogo."
    min-width-class="min-w-[54rem] rounded-[1.5rem]"
  />
</template>
