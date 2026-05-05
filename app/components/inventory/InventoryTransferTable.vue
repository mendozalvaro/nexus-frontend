<script setup lang="ts">
import { h, resolveComponent } from "vue";
import type { InventoryTransferRowView } from "@/utils/inventory";

const props = withDefaults(defineProps<{
  rows: InventoryTransferRowView[];
  loading?: boolean;
  formatDateTime: (value: string | null) => string;
}>(), {
  loading: false,
});

const getTransferStatusLabel = (status: InventoryTransferRowView["status"]) => {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "received":
      return "Recibida";
    case "cancelled":
      return "Cancelada";
    default:
      return status;
  }
};

const getTransferStatusColor = (status: InventoryTransferRowView["status"]): "success" | "warning" | "error" | "primary" | "neutral" => {
  switch (status) {
    case "received":
      return "success";
    case "pending":
      return "warning";
    case "cancelled":
      return "error";
    default:
      return "neutral";
  }
};

const columns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  
  return [
    {
      accessorKey: "productName",
      header: "Producto",
      cell: ({ row }: { row: { original: InventoryTransferRowView } }) => row.original.productName,
    },
    {
      accessorKey: "sourceBranchName",
      header: "Origen",
      cell: ({ row }: { row: { original: InventoryTransferRowView } }) => `${row.original.sourceBranchName} (${row.original.sourceBranchCode})`,
    },
    {
      accessorKey: "destinationBranchName",
      header: "Destino",
      cell: ({ row }: { row: { original: InventoryTransferRowView } }) => `${row.original.destinationBranchName} (${row.original.destinationBranchCode})`,
    },
    {
      accessorKey: "quantity",
      header: "Cantidad",
      cell: ({ row }: { row: { original: InventoryTransferRowView } }) => row.original.quantity,
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }: { row: { original: InventoryTransferRowView } }) =>
        h(UBadge, {
          color: getTransferStatusColor(row.original.status),
          variant: "soft",
        }, () => getTransferStatusLabel(row.original.status)),
    },
    {
      accessorKey: "requestedAt",
      header: "Fecha",
      cell: ({ row }: { row: { original: InventoryTransferRowView } }) => props.formatDateTime(row.original.requestedAt),
    },
  ];
});
</script>

<template>
  <UiDataTable
    :data="rows"
    :columns="columns"
    :loading="loading"
    empty="No hay transferencias para mostrar."
    min-width-class="min-w-full rounded-[1.5rem]"
  />
</template>
