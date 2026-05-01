<script setup lang="ts">
import { h, resolveComponent } from "vue";

import type { InventoryTransferRowView } from "@/composables/useInventory";

const props = withDefaults(defineProps<{
  rows: InventoryTransferRowView[];
  loading?: boolean;
  formatDateTime: (value: string | null) => string;
  canReceiveTransfer: (row: InventoryTransferRowView) => boolean;
  getReceiveBlockedReason: (row: InventoryTransferRowView) => string | null;
}>(), {
  loading: false,
});

const emits = defineEmits<{
  receive: [InventoryTransferRowView];
  viewDetails: [InventoryTransferRowView];
}>();

const statusColor = (status: InventoryTransferRowView["status"]): "success" | "warning" | "error" | "neutral" => {
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

const statusLabel = (status: InventoryTransferRowView["status"]) => {
  switch (status) {
    case "received":
      return "Recepcionada";
    case "pending":
      return "Pendiente";
    case "cancelled":
      return "Cancelada";
    default:
      return status;
  }
};

const columns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "internalNote",
      header: "Codigo",
      cell: ({ row }: { row: { original: InventoryTransferRowView } }) =>
        h("span", { class: "text-sm font-medium text-slate-700 dark:text-slate-200" }, row.original.internalNote ?? "--"),
    },
    {
      accessorKey: "requestedAt",
      header: "Fecha",
      cell: ({ row }: { row: { original: InventoryTransferRowView } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, props.formatDateTime(row.original.requestedAt)),
    },
    {
      id: "route",
      header: "Origen / Destino",
      cell: ({ row }: { row: { original: InventoryTransferRowView } }) =>
        h("div", { class: "space-y-1" }, [
          h("p", { class: "text-sm text-slate-700 dark:text-slate-200" }, `${row.original.sourceBranchName} (${row.original.sourceBranchCode})`),
          h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, `a ${row.original.destinationBranchName} (${row.original.destinationBranchCode})`),
        ]),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }: { row: { original: InventoryTransferRowView } }) =>
        h(UBadge, {
          color: statusColor(row.original.status),
          variant: "soft",
        }, () => statusLabel(row.original.status)),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: InventoryTransferRowView } }) => {
        const canReceive = props.canReceiveTransfer(row.original);
        const blockedReason = props.getReceiveBlockedReason(row.original);

        return h("div", { class: "space-y-2" }, [
          h("div", { class: "flex flex-wrap gap-2" }, [
            h(UButton, {
              size: "sm",
              color: "primary",
              variant: "soft",
              class: "min-h-9 justify-center",
              disabled: !canReceive,
              onClick: () => emits("receive", row.original),
            }, () => row.original.isBatch ? "Recepcionar lote" : "Recepcionar"),
            h(UButton, {
              size: "sm",
              color: "neutral",
              variant: "ghost",
              class: "min-h-9 justify-center",
              onClick: () => emits("viewDetails", row.original),
            }, () => "Ver detalles"),
          ]),
          !canReceive && blockedReason
            ? h("p", { class: "max-w-[18rem] text-[11px] leading-4 text-slate-500 dark:text-slate-400" }, blockedReason)
            : null,
        ]);
      },
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
