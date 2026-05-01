<script setup lang="ts">
import type { InventoryMovementRowView, InventoryTransferDetailData } from "@/composables/useInventory";

const props = defineProps<{
  open: boolean;
  title: string;
  movement: InventoryMovementRowView | null;
  transferDetails: InventoryTransferDetailData | null;
  formatDateTime: (value: string | null) => string;
  getMovementLabel: (value: InventoryMovementRowView["movementType"]) => string;
}>();

const emits = defineEmits<{
  "update:open": [boolean];
}>();

const transferStatusColor = computed((): "warning" | "success" | "error" | "neutral" => {
  switch (props.transferDetails?.status) {
    case "pending":
      return "warning";
    case "received":
      return "success";
    case "cancelled":
      return "error";
    default:
      return "neutral";
  }
});

const transferStatusLabel = computed(() => {
  switch (props.transferDetails?.status) {
    case "pending":
      return "Pendiente";
    case "received":
      return "Recepcionada";
    case "cancelled":
      return "Cancelada";
    default:
      return "Sin estado";
  }
});
</script>

<template>
  <UModal
    :open="props.open"
    :title="props.title"
    description="Trazabilidad completa del movimiento."
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <div v-if="props.movement" class="space-y-4">
        <div
          v-if="props.transferDetails && (props.movement.movementType === 'transfer_in' || props.movement.movementType === 'transfer_out')"
          class="space-y-4"
        >
          <div class="flex items-center justify-end">
            <UBadge :color="transferStatusColor" variant="soft" size="sm">
              {{ transferStatusLabel }}
            </UBadge>
          </div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <UCard class="rounded-xl border-slate-200/80 dark:border-slate-800">
              <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Datos de origen
              </p>
              <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {{ props.transferDetails.origin.branchName }} ({{ props.transferDetails.origin.branchCode }})
              </p>
              <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Usuario: {{ props.transferDetails.origin.userName ?? "Sistema" }}
              </p>
              <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Fecha: {{ props.formatDateTime(props.transferDetails.origin.date) }}
              </p>
            </UCard>

            <UCard class="rounded-xl border-slate-200/80 dark:border-slate-800">
              <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Datos de destino
              </p>
              <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {{ props.transferDetails.destination.branchName }} ({{ props.transferDetails.destination.branchCode }})
              </p>
              <template v-if="props.transferDetails.destination.pendingReception">
                <p class="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  Pendiente de recepción
                </p>
              </template>
              <template v-else>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Usuario: {{ props.transferDetails.destination.userName ?? "Sistema" }}
                </p>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Fecha: {{ props.formatDateTime(props.transferDetails.destination.date) }}
                </p>
              </template>
            </UCard>
          </div>

          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
            <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Lista de productos
            </p>
            <div class="mt-3 space-y-2">
              <div
                v-for="line in props.transferDetails.lines"
                :key="`${line.productId}:${line.quantity}`"
                class="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm dark:bg-slate-900"
              >
                <span class="text-slate-900 dark:text-slate-100">
                  {{ line.productName }}{{ line.sku ? ` (${line.sku})` : "" }}
                </span>
                <span class="font-medium text-slate-700 dark:text-slate-200">
                  {{ line.quantity }}
                </span>
              </div>
            </div>
            <p v-if="props.transferDetails.observations" class="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Observaciones: {{ props.transferDetails.observations }}
            </p>
          </div>
        </div>

        <template v-else>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <UCard class="rounded-xl border-slate-200/80 dark:border-slate-800">
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tipo
            </p>
            <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ props.getMovementLabel(props.movement.movementType) }}
            </p>
          </UCard>
          <UCard class="rounded-xl border-slate-200/80 dark:border-slate-800">
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Sucursal
            </p>
            <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ props.movement.branchName }} ({{ props.movement.branchCode }})
            </p>
          </UCard>
        </div>

        <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/50">
          <p class="font-medium text-slate-900 dark:text-slate-100">
            {{ props.movement.productName }}{{ props.movement.sku ? ` (${props.movement.sku})` : "" }}
          </p>
          <p class="mt-1 text-slate-600 dark:text-slate-300">
            Cantidad: {{ props.movement.quantity }}
          </p>
          <p class="mt-1 text-slate-600 dark:text-slate-300">
            Stock: {{ props.movement.previousQuantity }} -> {{ props.movement.newQuantity }}
          </p>
          <p class="mt-1 text-slate-600 dark:text-slate-300">
            Fecha: {{ props.formatDateTime(props.movement.createdAt) }}
          </p>
          <p class="mt-1 text-slate-600 dark:text-slate-300">
            Usuario: {{ props.movement.createdByName ?? "Sistema" }}
          </p>
          <p v-if="props.movement.reason" class="mt-2 text-slate-700 dark:text-slate-200">
            Motivo: {{ props.movement.reason }}
          </p>
        </div>
        </template>
      </div>
    </template>
  </UModal>
</template>
