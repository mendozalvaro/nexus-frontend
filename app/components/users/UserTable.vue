<script setup lang="ts">
import { h, resolveComponent } from "vue";

import type { UserListRow } from "@/composables/useUsers";

const props = defineProps<{
  rows: UserListRow[];
  loading?: boolean;
  actorRole?: "admin" | "manager";
}>();

const emits = defineEmits<{
  edit: [UserListRow];
  deactivate: [UserListRow];
}>();

const sortBy = ref<"fullName" | "role" | "lastLoginAt">("fullName");
const sortDirection = ref<"asc" | "desc">("asc");
const page = ref(1);
const pageSize = 10;

watch(
  () => props.rows.length,
  () => {
    page.value = 1;
  },
);

const sortedRows = computed(() => {
  const multiplier = sortDirection.value === "asc" ? 1 : -1;

  return [...props.rows].sort((left, right) => {
    const leftValue = left[sortBy.value] ?? "";
    const rightValue = right[sortBy.value] ?? "";

    return String(leftValue).localeCompare(String(rightValue), "es") * multiplier;
  });
});

const pageCount = computed(() => Math.max(1, Math.ceil(sortedRows.value.length / pageSize)));

const paginatedRows = computed(() => {
  const start = (page.value - 1) * pageSize;
  return sortedRows.value.slice(start, start + pageSize);
});

const canManageRow = (row: UserListRow) => {
  if (props.actorRole === "manager") {
    return row.role === "employee";
  }

  return row.role !== "admin";
};

const columns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "fullName",
      header: "Usuario",
      cell: ({ row }: { row: { original: UserListRow } }) =>
        h("div", { class: "min-w-0 space-y-1" }, [
          h("p", { class: "font-medium text-slate-950 dark:text-white" }, row.original.fullName),
          h("p", { class: "text-sm text-slate-500 dark:text-slate-400" }, row.original.email),
        ]),
    },
    {
      accessorKey: "role",
      header: "Rol",
      cell: ({ row }: { row: { original: UserListRow } }) =>
        h(
          UBadge,
          {
            color:
              row.original.role === "admin"
                ? "error"
                : row.original.role === "manager"
                  ? "warning"
                  : "primary",
            variant: "soft",
          },
          () => row.original.role,
        ),
    },
    {
      accessorKey: "isActive",
      header: "Estado",
      cell: ({ row }: { row: { original: UserListRow } }) =>
        h(
          UBadge,
          { color: row.original.isActive ? "success" : "neutral", variant: "soft" },
          () => (row.original.isActive ? "Activo" : "Inactivo"),
        ),
    },
    {
      accessorKey: "lastLoginAt",
      header: "Ultimo acceso",
      cell: ({ row }: { row: { original: UserListRow } }) =>
        row.original.lastLoginAt
          ? new Intl.DateTimeFormat("es-BO", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(row.original.lastLoginAt))
          : "Sin acceso",
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: UserListRow } }) =>
        h("div", { class: "flex flex-col gap-2 sm:flex-row sm:items-center" }, [
          h(
            UButton,
            {
              color: "neutral",
              variant: "ghost",
              size: "sm",
              class: "min-h-10 justify-center sm:min-h-9",
              disabled: !canManageRow(row.original),
              onClick: () => emits("edit", row.original),
            },
            () => "Editar",
          ),
          h(
            UButton,
            {
              color: "error",
              variant: "ghost",
              size: "sm",
              class: "min-h-10 justify-center sm:min-h-9",
              disabled: !row.original.isActive || !canManageRow(row.original),
              onClick: () => emits("deactivate", row.original),
            },
            () => "Desactivar",
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
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
            <select v-model="sortBy" class="min-h-10 w-full bg-transparent text-sm outline-none">
              <option value="fullName">Ordenar por nombre</option>
              <option value="role">Ordenar por rol</option>
              <option value="lastLoginAt">Ordenar por ultimo acceso</option>
            </select>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
            <select v-model="sortDirection" class="min-h-10 w-full bg-transparent text-sm outline-none">
              <option value="asc">Ascendente</option>
              <option value="desc">Descendente</option>
            </select>
          </div>
        </div>
      </template>

      <template #summary>
        {{ rows.length }} usuario(s) encontrados
      </template>
    </UiSearchFilters>

    <UiDataTable
      :data="paginatedRows"
      :columns="columns"
      :loading="loading"
      empty="No hay usuarios para mostrar."
      min-width-class="min-w-[46rem] rounded-[1.5rem]"
      :page="page"
      :page-count="pageCount"
      :previous-disabled="page <= 1"
      :next-disabled="page >= pageCount"
      @previous="page -= 1"
      @next="page += 1"
    />
  </div>
</template>
