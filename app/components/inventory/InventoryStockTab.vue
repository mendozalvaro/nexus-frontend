<script setup lang="ts">
import type { InventoryProductRowView, InventoryTransferRowView } from "@/composables/useInventory";
import InventoryStockTable from "@/components/features/InventoryStockTable.vue";

const props = defineProps<{
  stockQuery: string;
  stockRows: InventoryProductRowView[];
  overviewPending: boolean;
  showStockBranchesColumn: boolean;
  activeBranchIds: string[];
  pendingStockReceipts: InventoryTransferRowView[];
  canReceiveTransfer: (row: InventoryTransferRowView) => boolean;
  canRejectTransfer: (row: InventoryTransferRowView) => boolean;
}>();

const emits = defineEmits<{
  "update:stockQuery": [string];
  openMovement: [];
  openTransfer: [];
  receiveTransfer: [InventoryTransferRowView];
  rejectTransfer: [InventoryTransferRowView];
}>();

const stockQueryModel = computed({
  get: () => props.stockQuery,
  set: (value: string) => emits("update:stockQuery", value),
});
</script>

<template>
  <UiSectionShell
    eyebrow="Stock"
    title="Productos operativos"
    description="Una sola vista para registrar movimientos y consultar disponibilidad por categoria."
  >
    <UiSearchFilters title="Buscar producto" description="Filtra por nombre, SKU o categoria." surface>
      <template #controls>
        <div class="flex flex-wrap items-center gap-3">
          <UInput
            v-model="stockQueryModel"
            icon="i-lucide-search"
            placeholder="Buscar en inventario"
            :ui="{ base: 'min-h-11 text-base' }"
            class="min-w-[18rem] flex-1"
          />
          <UButton color="primary" icon="i-lucide-package-plus" @click="emits('openMovement')">
            Registrar movimiento
          </UButton>
          <UButton color="neutral" variant="soft" icon="i-lucide-arrow-left-right" @click="emits('openTransfer')">
            Transferir stock
          </UButton>
        </div>
      </template>
      <template #summary>
        {{ props.stockRows.length }} producto(s)
      </template>
    </UiSearchFilters>

    <UAlert
      v-if="props.pendingStockReceipts.length > 0"
      color="warning"
      variant="soft"
      icon="i-lucide-inbox"
      :description="`Tienes ${props.pendingStockReceipts.length} transferencia(s) pendiente(s) por recepcionar desde Stock.`"
    />

    <div v-if="props.pendingStockReceipts.length > 0" class="mt-3 space-y-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div
        v-for="row in props.pendingStockReceipts"
        :key="row.id"
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/90 px-3 py-2 text-sm dark:bg-slate-900/70"
      >
        <div>
          <p class="font-medium text-slate-900 dark:text-slate-100">
            {{ row.internalNote ?? row.productName }}
          </p>
          <p class="text-slate-600 dark:text-slate-300">
            {{ row.sourceBranchCode }} -> {{ row.destinationBranchCode }} · {{ row.quantity }} unidad(es)
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton size="sm" color="warning" variant="soft" :disabled="!props.canReceiveTransfer(row)" @click="emits('receiveTransfer', row)">
            Recepcionar
          </UButton>
          <UButton size="sm" color="error" variant="soft" :disabled="!props.canRejectTransfer(row)" @click="emits('rejectTransfer', row)">
            Rechazar
          </UButton>
        </div>
      </div>
    </div>

    <InventoryStockTable
      :rows="props.stockRows"
      :loading="props.overviewPending"
      :show-branches="props.showStockBranchesColumn"
      :active-branch-ids="props.activeBranchIds"
    />
  </UiSectionShell>
</template>
