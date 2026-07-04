<script setup lang="ts">
import { h, resolveComponent } from "vue";

import type { CustomerRow } from "@/composables/useCustomers";

const props = defineProps<{
  rows: CustomerRow[];
  loading?: boolean;
  page?: number;
  pageCount?: number;
  pageLabel?: string;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
}>();

const emits = defineEmits<{
  edit: [CustomerRow];
  setStatus: [CustomerRow, "active" | "inactive" | "blocked"];
  openMerge: [CustomerRow];
  previous: [];
  next: [];
}>();

const columns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "fullName",
      header: "Cliente",
      cell: ({ row }: { row: { original: CustomerRow } }) =>
        h("div", { class: "min-w-0 space-y-1" }, [
          h("p", { class: "font-medium text-slate-950 dark:text-white" }, row.original.fullName),
          h("p", { class: "text-sm text-slate-500 dark:text-slate-400" }, row.original.email ?? "Sin email"),
        ]),
    },
    {
      accessorKey: "phone",
      header: "Telefono",
      cell: ({ row }: { row: { original: CustomerRow } }) => row.original.phone ?? "—",
    },
    {
      accessorKey: "documentNumber",
      header: "Documento",
      cell: ({ row }: { row: { original: CustomerRow } }) =>
        row.original.documentType && row.original.documentNumber
          ? `${row.original.documentType} · ${row.original.documentNumber}`
          : "—",
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }: { row: { original: CustomerRow } }) =>
        h(
          UBadge,
          {
            color:
              row.original.status === "active"
                ? "success"
                : row.original.status === "blocked"
                  ? "error"
                  : "neutral",
            variant: "soft",
          },
          () => row.original.status,
        ),
    },
    {
      accessorKey: "updatedAt",
      header: "Actualizado",
      cell: ({ row }: { row: { original: CustomerRow } }) =>
        new Date(row.original.updatedAt).toLocaleDateString("es-BO"),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: CustomerRow } }) =>
        h("div", { class: "flex flex-col gap-2 sm:flex-row sm:items-center" }, [
          h(
            UButton,
            {
              color: "neutral",
              variant: "ghost",
              size: "sm",
              class: "min-h-10 justify-center sm:min-h-9",
              disabled: row.original.isAnonymousTemplate,
              onClick: () => emits("edit", row.original),
            },
            () => "Editar",
          ),
          h(
            UButton,
            {
              color: row.original.status === "blocked" ? "success" : "warning",
              variant: "ghost",
              size: "sm",
              class: "min-h-10 justify-center sm:min-h-9",
              disabled: row.original.isAnonymousTemplate,
              onClick: () =>
                emits("setStatus", row.original, row.original.status === "blocked" ? "active" : "blocked"),
            },
            () => (row.original.status === "blocked" ? "Activar" : "Bloquear"),
          ),
          h(
            UButton,
            {
              color: "primary",
              variant: "ghost",
              size: "sm",
              class: "min-h-10 justify-center sm:min-h-9",
              disabled: row.original.isAnonymousTemplate,
              onClick: () => emits("openMerge", row.original),
            },
            () => "Fusionar",
          ),
        ]),
    },
  ];
});
</script>

<template>
  <UiDataTable
    :data="rows"
    :columns="columns"
    :loading="loading"
    empty="No hay clientes para mostrar."
    min-width-class="min-w-[54rem] rounded-[1.5rem]"
    :page="page"
    :page-count="pageCount"
    :page-label="pageLabel"
    :previous-disabled="previousDisabled"
    :next-disabled="nextDisabled"
    @previous="emits('previous')"
    @next="emits('next')"
  />
</template>
