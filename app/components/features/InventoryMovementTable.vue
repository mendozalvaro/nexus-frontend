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

const emits = defineEmits<{
  viewDetails: [InventoryMovementRowView];
}>();

const getHistoryTypeLabel = (movementType: InventoryMovementRowView["movementType"]) => {
  switch (movementType) {
    case "entry":
      return "Ingreso";
    case "exit":
      return "Salida";
    case "transfer_out":
      return "Transferencia enviada";
    case "transfer_in":
      return "Transferencia recibida";
    case "adjustment":
    default:
      return "Ajuste";
  }
};

const getHistoryTypeColor = (
  movementType: InventoryMovementRowView["movementType"],
): "success" | "warning" | "error" | "primary" | "neutral" => {
  switch (movementType) {
    case "entry":
      return "success";
    case "exit":
      return "error";
    case "transfer_out":
      return "warning";
    case "transfer_in":
      return "neutral";
    case "adjustment":
    default:
      return "primary";
  }
};

const columns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "note",
      header: "Codigo",
      cell: ({ row }: { row: { original: InventoryMovementRowView } }) =>
        h("span", { class: "text-xs text-slate-700 dark:text-slate-300" }, row.original.note ?? "--"),
    },
    {
      accessorKey: "createdAt",
      header: "Fecha",
      cell: ({ row }: { row: { original: InventoryMovementRowView } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, props.formatDateTime(row.original.createdAt)),
    },
    {
      accessorKey: "movementType",
      header: "Tipo",
      cell: ({ row }: { row: { original: InventoryMovementRowView } }) =>
        h(UBadge, {
          color: getHistoryTypeColor(row.original.movementType),
          variant: "soft",
        }, () => getHistoryTypeLabel(row.original.movementType)),
    },
    {
      accessorKey: "branchName",
      header: "Sucursal",
      cell: ({ row }: { row: { original: InventoryMovementRowView } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, `${row.original.branchName} (${row.original.branchCode})`),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: InventoryMovementRowView } }) =>
        h(UButton, {
          size: "sm",
          color: "neutral",
          variant: "ghost",
          class: "min-h-9 justify-center",
          onClick: () => emits("viewDetails", row.original),
        }, () => "Ver detalles"),
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
    min-width-class="min-w-full rounded-[1.5rem]"
  />
</template>
