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
  edit: [InventoryProductRowView];
  toggleStatus: [InventoryProductRowView];
  adjustStock: [InventoryProductRowView];
  transferStock: [InventoryProductRowView];
}>();

const page = ref(1);
const pageSize = 10;
const sortBy = ref<"name" | "categoryName" | "salePrice" | "totalQuantity">("name");
const sortDirection = ref<"asc" | "desc">("asc");

watch(
  () => props.rows.length,
  () => {
    page.value = 1;
  },
);

const sortedRows = computed(() => {
  const multiplier = sortDirection.value === "asc" ? 1 : -1;

  return [...props.rows].sort((left, right) => {
    if (sortBy.value === "salePrice" || sortBy.value === "totalQuantity") {
      return ((left[sortBy.value] ?? 0) - (right[sortBy.value] ?? 0)) * multiplier;
    }

    return String(left[sortBy.value] ?? "").localeCompare(String(right[sortBy.value] ?? ""), "es") * multiplier;
  });
});

const pageCount = computed(() => Math.max(1, Math.ceil(sortedRows.value.length / pageSize)));

const paginatedRows = computed(() => {
  const start = (page.value - 1) * pageSize;
  return sortedRows.value.slice(start, start + pageSize);
});

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
          h(
            "p",
            { class: "truncate text-xs text-slate-500 dark:text-slate-400" },
            row.original.sku ?? "Sin SKU",
          ),
        ]),
    },
    {
      accessorKey: "categoryName",
      header: "Categoria",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) =>
        h("span", { class: "whitespace-nowrap text-sm text-slate-600 dark:text-slate-300" }, row.original.categoryName ?? "Sin categoria"),
    },
    {
      accessorKey: "salePrice",
      header: "Precio",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) =>
        h("span", { class: "whitespace-nowrap text-sm font-medium text-slate-950 dark:text-white" }, `Bs ${row.original.salePrice.toFixed(2)}`),
    },
    {
      accessorKey: "totalQuantity",
      header: "Stock total",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) =>
        h("div", { class: "min-w-0 space-y-1" }, [
          h("p", { class: "font-medium text-slate-950 dark:text-white" }, `${row.original.totalQuantity} unid.`),
          h(
            "p",
            { class: "text-xs text-slate-500 dark:text-slate-400" },
            `${row.original.lowStockBranchesCount} sucursal(es) en alerta`,
          ),
        ]),
    },
    {
      accessorKey: "isActive",
      header: "Estado",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) =>
        h(UBadge, { color: row.original.isActive ? "success" : "neutral", variant: "soft" }, () => (
          row.original.isActive ? "Activo" : "Inactivo"
        )),
    },
    {
      accessorKey: "stockByBranch",
      header: "Sucursales",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) =>
        h("div", { class: "flex min-w-[12rem] flex-wrap gap-1.5" }, row.original.stockByBranch.slice(0, 3).map((stock) =>
          h(
            UBadge,
            {
              color: stock.isLowStock ? "warning" : "neutral",
              variant: "soft",
              class: "rounded-full",
            },
            () => `${stock.branchCode}: ${stock.quantity}`,
          ),
        )),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: InventoryProductRowView } }) =>
        h("div", { class: "flex min-w-[10rem] flex-col gap-2 sm:flex-row sm:flex-wrap" }, [
          h(UButton, { size: "sm", color: "neutral", variant: "ghost", class: "min-h-10 justify-center sm:justify-start", onClick: () => emits("edit", row.original) }, () => "Editar"),
          h(UButton, { size: "sm", color: "primary", variant: "ghost", class: "min-h-10 justify-center sm:justify-start", onClick: () => emits("adjustStock", row.original) }, () => "Ajustar"),
          h(UButton, { size: "sm", color: "warning", variant: "ghost", class: "min-h-10 justify-center sm:justify-start", onClick: () => emits("transferStock", row.original) }, () => "Transferir"),
          h(
            UButton,
            {
              size: "sm",
              color: row.original.isActive ? "error" : "success",
              variant: "ghost",
              class: "min-h-10 justify-center sm:justify-start",
              onClick: () => emits("toggleStatus", row.original),
            },
            () => row.original.isActive ? "Desactivar" : "Activar",
          ),
        ]),
    },
  ];
});
</script>

<template>
  <div class="space-y-4 md:space-y-5">
    <UiSearchFilters>
      <template #controls>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="space-y-1">
            <span class="text-sm font-medium text-slate-600 dark:text-slate-300">Ordenar por</span>
            <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <select v-model="sortBy" class="min-h-10 w-full bg-transparent text-sm outline-none">
                <option value="name">Nombre</option>
                <option value="categoryName">Categoria</option>
                <option value="salePrice">Precio</option>
                <option value="totalQuantity">Stock</option>
              </select>
            </div>
          </label>

          <label class="space-y-1">
            <span class="text-sm font-medium text-slate-600 dark:text-slate-300">Direccion</span>
            <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <select v-model="sortDirection" class="min-h-10 w-full bg-transparent text-sm outline-none">
                <option value="asc">Ascendente</option>
                <option value="desc">Descendente</option>
              </select>
            </div>
          </label>
        </div>
      </template>

      <template #summary>
        {{ rows.length }} producto(s)
      </template>
    </UiSearchFilters>

    <UiDataTable
      :data="paginatedRows"
      :columns="columns"
      :loading="loading"
      empty="No hay productos para mostrar."
      min-width-class="min-w-[58rem] rounded-[1.5rem]"
      :page="page"
      :page-count="pageCount"
      :previous-disabled="page <= 1"
      :next-disabled="page >= pageCount"
      @previous="page -= 1"
      @next="page += 1"
    />
  </div>
</template>
