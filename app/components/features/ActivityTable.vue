<script setup lang="ts">
import type { DashboardActivityRow } from "@/composables/useDashboard";

withDefaults(defineProps<{
  rows: DashboardActivityRow[];
  loading?: boolean;
  emptyMessage?: string;
}>(), {
  loading: false,
  emptyMessage: "No hay actividad reciente para este rango.",
});

const statusColor = (status: string): "neutral" | "success" | "warning" | "error" => {
  switch (status) {
    case "completed":
      return "success";
    case "refunded":
      return "warning";
    case "voided":
      return "error";
    default:
      return "neutral";
  }
};

const statusLabel = (status: string): string => {
  switch (status) {
    case "completed":
      return "Completada";
    case "refunded":
      return "Reembolsada";
    case "voided":
      return "Anulada";
    default:
      return "Pendiente";
  }
};
</script>

<template>
  <UCard class="admin-shell-panel rounded-[1.75rem]">
    <template #header>
      <div>
        <h2 class="text-lg font-semibold text-slate-950 dark:text-white">
          Actividad reciente
        </h2>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          &Uacute;ltimas 10 transacciones del per&iacute;odo filtrado.
        </p>
      </div>
    </template>

    <div v-if="loading" class="space-y-3">
      <div
        v-for="index in 6"
        :key="index"
        class="h-14 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
      />
    </div>

    <div v-else-if="rows.length === 0" class="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
      <p class="text-sm text-slate-600 dark:text-slate-300">
        {{ emptyMessage }}
      </p>
    </div>

    <div v-else class="space-y-4">
      <div class="grid gap-3 md:hidden">
        <article
          v-for="row in rows"
          :key="`${row.id}-mobile`"
          class="rounded-2xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-slate-950/50"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-slate-950 dark:text-white">
                {{ row.invoiceNumber }}
              </p>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {{ row.branchName }} <span aria-hidden="true">&middot;</span> {{ row.employeeName }}
              </p>
            </div>
            <UBadge :color="statusColor(row.status)" variant="soft">
              {{ statusLabel(row.status) }}
            </UBadge>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">M&eacute;todo</p>
              <p class="mt-1 text-slate-700 dark:text-slate-200">{{ row.paymentMethod }}</p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Monto</p>
              <p class="mt-1 font-semibold text-slate-950 dark:text-white">
                {{ new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" }).format(row.amount) }}
              </p>
            </div>
          </div>

          <p class="mt-4 text-xs text-slate-600 dark:text-slate-300">
            {{ new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(row.createdAt)) }}
          </p>
        </article>
      </div>

      <div class="hidden overflow-x-auto md:block">
        <table class="min-w-full text-left text-sm">
          <thead class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            <tr>
              <th class="pb-3 pr-4 font-medium">Factura</th>
              <th class="px-4 pb-3 font-medium">Sucursal</th>
              <th class="px-4 pb-3 font-medium">Responsable</th>
              <th class="px-4 pb-3 font-medium">M&eacute;todo</th>
              <th class="px-4 pb-3 font-medium">Monto</th>
              <th class="px-4 pb-3 font-medium">Estado</th>
              <th class="pl-4 pb-3 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="row in rows" :key="row.id" class="admin-interactive hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
              <td class="py-4 pr-4 font-medium text-slate-950 dark:text-white">
                {{ row.invoiceNumber }}
              </td>
              <td class="px-4 py-4 text-slate-700 dark:text-slate-200">
                {{ row.branchName }}
              </td>
              <td class="px-4 py-4 text-slate-700 dark:text-slate-200">
                {{ row.employeeName }}
              </td>
              <td class="px-4 py-4 text-slate-700 dark:text-slate-200">
                {{ row.paymentMethod }}
              </td>
              <td class="px-4 py-4 font-medium text-slate-950 dark:text-white">
                {{ new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" }).format(row.amount) }}
              </td>
              <td class="px-4 py-4">
                <UBadge :color="statusColor(row.status)" variant="soft">
                  {{ statusLabel(row.status) }}
                </UBadge>
              </td>
              <td class="pl-4 py-4 text-slate-600 dark:text-slate-300">
                {{ new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(row.createdAt)) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </UCard>
</template>
