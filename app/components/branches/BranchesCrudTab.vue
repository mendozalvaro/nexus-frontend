<script setup lang="ts">
import { h, resolveComponent } from "vue";

import type { BranchListItem } from "@/composables/useBranches";

const props = defineProps<{
  rows: BranchListItem[];
  searchQuery: string;
  loading?: boolean;
  canCreateMoreBranches: boolean;
}>();

const emits = defineEmits<{
  "update:searchQuery": [string];
  create: [];
  edit: [BranchListItem];
  "toggle-status": [{ branchId: string; nextState: boolean }];
}>();

const columns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "name",
      header: "Sucursal",
      cell: ({ row }: { row: { original: BranchListItem } }) =>
        h("div", { class: "space-y-1" }, [
          h("p", { class: "font-medium text-slate-950 dark:text-white" }, row.original.name),
          h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, row.original.code),
        ]),
    },
    {
      accessorKey: "address",
      header: "Direccion",
      cell: ({ row }: { row: { original: BranchListItem } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, row.original.address ?? "No definida"),
    },
    {
      accessorKey: "phone",
      header: "Telefono",
      cell: ({ row }: { row: { original: BranchListItem } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, row.original.phone ?? "No asignado"),
    },
    {
      accessorKey: "stats.employeesCount",
      header: "Empleados",
      cell: ({ row }: { row: { original: BranchListItem } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, `${row.original.stats.employeesCount}`),
    },
    {
      accessorKey: "stats.salesTotal",
      header: "Ventas",
      cell: ({ row }: { row: { original: BranchListItem } }) =>
        h(
          "span",
          { class: "text-sm font-medium text-slate-950 dark:text-white" },
          `Bs ${row.original.stats.salesTotal.toFixed(2)}`,
        ),
    },
    {
      accessorKey: "isActive",
      header: "Estado",
      cell: ({ row }: { row: { original: BranchListItem } }) =>
        h(UBadge, { color: row.original.isActive ? "success" : "neutral", variant: "soft" }, () => row.original.isActive ? "Activo" : "Inactivo"),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: BranchListItem } }) =>
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
            onClick: () => emits("toggle-status", { branchId: row.original.id, nextState: !row.original.isActive }),
          }, () => row.original.isActive ? "Desactivar" : "Activar"),
        ]),
    },
  ];
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <div class="flex justify-end">
      <UButton color="primary" icon="i-lucide-plus" :disabled="!canCreateMoreBranches" @click="emits('create')">
        Nueva sucursal
      </UButton>
    </div>

    <UiSearchFilters title="Buscar sucursales" description="Filtra por nombre, codigo, direccion o telefono." surface>
      <template #controls>
        <UInput
          :model-value="searchQuery"
          icon="i-lucide-search"
          placeholder="Buscar..."
          :ui="{ base: 'min-h-11 text-base' }"
          @update:model-value="emits('update:searchQuery', String($event ?? ''))"
        />
      </template>
      <template #summary>
        {{ rows.length }} sucursal(es)
      </template>
    </UiSearchFilters>

    <UiDataTable
      :data="rows"
      :columns="columns"
      :loading="loading"
      empty="No hay sucursales disponibles."
      min-width-class="min-w-[60rem] rounded-[1.5rem]"
    />
  </div>
</template>
