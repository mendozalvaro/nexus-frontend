<script setup lang="ts">
import { h, resolveComponent } from "vue";

import type { PaymentValidationListRow } from "@/composables/usePaymentSystem";

const props = defineProps<{
  rows: PaymentValidationListRow[];
  loading?: boolean;
  page: number;
  pageCount: number;
  total: number;
}>();

const emit = defineEmits<{
  view: [PaymentValidationListRow];
  approve: [PaymentValidationListRow];
  reject: [PaymentValidationListRow];
  previous: [];
  next: [];
}>();

const formatDate = (value: string | null) => {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatTimeAgo = (value: string | null) => {
  if (!value) {
    return "";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `Hace ${diffMinutes} min`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `Hace ${diffHours} h`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `Hace ${diffDays} dia(s)`;
};

const columns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "organizationName",
      header: "Organizacion",
      cell: ({ row }: { row: { original: PaymentValidationListRow } }) =>
        h("div", { class: "space-y-1" }, [
          h("p", { class: "font-medium text-slate-950 dark:text-white" }, row.original.organizationName),
          h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, row.original.organizationSlug),
        ]),
    },
    {
      accessorKey: "userFullName",
      header: "Usuario",
      cell: ({ row }: { row: { original: PaymentValidationListRow } }) =>
        h("div", { class: "space-y-1" }, [
          h("p", { class: "font-medium text-slate-950 dark:text-white" }, row.original.userFullName),
          h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, row.original.userEmail),
        ]),
    },
    {
      accessorKey: "amount",
      header: "Monto",
      cell: ({ row }: { row: { original: PaymentValidationListRow } }) =>
        h("span", { class: "font-mono font-semibold text-slate-950 dark:text-white" }, `$${row.original.amount.toFixed(2)}`),
    },
    {
      accessorKey: "transactionRef",
      header: "Referencia",
      cell: ({ row }: { row: { original: PaymentValidationListRow } }) =>
        h("span", { class: "font-mono text-sm text-slate-600 dark:text-slate-300" }, row.original.transactionRef ?? "N/A"),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }: { row: { original: PaymentValidationListRow } }) => {
        const color = row.original.status === "approved"
          ? "success"
          : row.original.status === "rejected"
            ? "error"
            : "warning";

        const label = row.original.status === "approved"
          ? "Aprobado"
          : row.original.status === "rejected"
            ? "Rechazado"
            : "Pendiente";

        return h(
          UBadge,
          { color, variant: "soft", class: "capitalize" },
          () => label,
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Enviado",
      cell: ({ row }: { row: { original: PaymentValidationListRow } }) =>
        h("div", { class: "space-y-1" }, [
          h("p", { class: "text-sm text-slate-950 dark:text-white" }, formatDate(row.original.createdAt)),
          h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, formatTimeAgo(row.original.createdAt)),
        ]),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: PaymentValidationListRow } }) =>
        h("div", { class: "flex flex-wrap items-center gap-2" }, [
          row.original.status === "pending"
            ? h(
              UButton,
              {
                color: "success",
                variant: "ghost",
                size: "sm",
                onClick: () => emit("approve", row.original),
              },
              () => "Aprobar",
            )
            : null,
          row.original.status === "pending"
            ? h(
              UButton,
              {
                color: "error",
                variant: "ghost",
                size: "sm",
                onClick: () => emit("reject", row.original),
              },
              () => "Rechazar",
            )
            : null,
          h(
            UButton,
            {
              color: "neutral",
              variant: "ghost",
              size: "sm",
              onClick: () => emit("view", row.original),
            },
            () => "Ver",
          ),
        ]),
    },
  ];
});
</script>

<template>
  <div class="space-y-4">
    <UTable
      :data="rows"
      :columns="columns"
      :loading="loading"
      empty="No hay validaciones para mostrar."
      class="rounded-[1.5rem]"
    />

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        {{ total }} validacion(es) • Pagina {{ page }} de {{ pageCount }}
      </p>

      <div class="flex items-center gap-2">
        <UButton
          color="neutral"
          variant="soft"
          size="sm"
          :disabled="page <= 1"
          @click="emit('previous')"
        >
          Anterior
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          size="sm"
          :disabled="page >= pageCount"
          @click="emit('next')"
        >
          Siguiente
        </UButton>
      </div>
    </div>
  </div>
</template>
