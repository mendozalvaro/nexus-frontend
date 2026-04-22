<script setup lang="ts">
import { h, resolveComponent } from "vue";

import type { CatalogServiceItem } from "@/composables/useCatalog";

const props = defineProps<{
  rows: CatalogServiceItem[];
  loading?: boolean;
}>();

const emits = defineEmits<{
  edit: [CatalogServiceItem];
  "toggle-status": [{ id: string; nextState: boolean }];
}>();

const { resolveCatalogImage } = useCatalogMedia();

const columns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "name",
      header: "Servicio",
      cell: ({ row }: { row: { original: CatalogServiceItem } }) =>
        h("div", { class: "flex items-center gap-3" }, [
          row.original.imageUrl
            ? h("img", { src: resolveCatalogImage(row.original.imageUrl, "service"), alt: row.original.name, class: "h-10 w-10 rounded-lg object-cover" })
            : h("img", { src: resolveCatalogImage(null, "service"), alt: "Placeholder de servicio", class: "h-10 w-10 rounded-lg object-cover" }),
          h("div", { class: "space-y-1 min-w-0" }, [
            h("p", { class: "truncate font-medium text-slate-950 dark:text-white" }, row.original.name),
            h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, `${row.original.durationMinutes} min`),
          ]),
        ]),
    },
    {
      accessorKey: "categoryName",
      header: "Categoria",
      cell: ({ row }: { row: { original: CatalogServiceItem } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, row.original.categoryName ?? "Sin categoria"),
    },
    {
      accessorKey: "price",
      header: "Precio",
      cell: ({ row }: { row: { original: CatalogServiceItem } }) =>
        h("span", { class: "text-sm font-medium text-slate-950 dark:text-white" }, `Bs ${row.original.price.toFixed(2)}`),
    },
    {
      accessorKey: "isActive",
      header: "Estado",
      cell: ({ row }: { row: { original: CatalogServiceItem } }) =>
        h(UBadge, { color: row.original.isActive ? "success" : "neutral", variant: "soft" }, () => row.original.isActive ? "Activo" : "Inactivo"),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: CatalogServiceItem } }) =>
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
    empty="No hay servicios en el catalogo."
    min-width-class="min-w-[60rem] rounded-[1.5rem]"
  />
</template>
