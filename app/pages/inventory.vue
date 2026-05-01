<script setup lang="ts">
import InventoryMovementModal from "@/components/modals/InventoryMovementModal.vue";
import InventoryTransferModal from "@/components/modals/InventoryTransferModal.vue";
import InventoryMovementsTab from "@/components/inventory/InventoryMovementsTab.vue";
import InventoryStockTab from "@/components/inventory/InventoryStockTab.vue";
import InventorySummaryTab from "@/components/inventory/InventorySummaryTab.vue";
import InventoryMovementDetailsModal from "@/components/inventory/InventoryMovementDetailsModal.vue";
import type { InventoryMovementFilters } from "@/composables/useInventory";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "inventory.view",
  roles: ["admin", "manager"],
  featureFlag: "feature_inventory",
});

const {
  activeTab,
  stockQuery,
  movementModalOpen,
  transferModalOpen,
  movementLoading,
  transferLoading,
  selectedProductId,
  movementDetailsModalOpen,
  selectedMovementDetails,
  selectedTransferDetails,
  movementPrecheckErrors,
  transferPrecheckErrors,
  movementPrecheckNormalization,
  transferPrecheckNormalization,
  movementPrecheckWarnings,
  transferPrecheckWarnings,
  actorRole,
  selectedBranchId,
  overviewPending,
  movementsPending,
  overview,
  transferState,
  movementState,
  activeBranches,
  activeBranchIds,
  showStockBranchesColumn,
  stockRows,
  movementFilters,
  movementDateFrom,
  movementDateTo,
  movementBranchModel,
  movementProductModel,
  movementTypeOptions,
  movementBranchOptions,
  movementProductOptions,
  pendingStockReceipts,
  metrics,
  openMovementModal,
  openTransferModal,
  canReceiveTransfer,
  canRejectTransfer,
  handleMovementValidate,
  handleMovementSubmit,
  handleTransferSubmit,
  handleReceiveTransfer,
  handleRejectTransfer,
  handleViewMovementDetails,
  movementDetailTitle,
  goToStockFromAlert,
  formatDateTime,
  getMovementLabel,
  getMovementColor,
} = useInventoryPage();

const handleMovementTypeUpdate = (value: string) => {
  movementFilters.movementType = value as InventoryMovementFilters["movementType"];
};
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <GlobalBranchContextSelector
      module-key="inventory"
      title="Contexto de inventario"
      description="Este contexto fija la sucursal para consultas y operaciones de inventario."
    />

    <div class="flex flex-wrap gap-2">
      <UButton :variant="activeTab === 'summary' ? 'solid' : 'soft'" :color="activeTab === 'summary' ? 'primary' : 'neutral'" @click="activeTab = 'summary'">
        Resumen
      </UButton>
      <UButton :variant="activeTab === 'stock' ? 'solid' : 'soft'" :color="activeTab === 'stock' ? 'primary' : 'neutral'" @click="activeTab = 'stock'">
        Stock
      </UButton>
      <UButton :variant="activeTab === 'movements' ? 'solid' : 'soft'" :color="activeTab === 'movements' ? 'primary' : 'neutral'" @click="activeTab = 'movements'">
        Movimientos
      </UButton>
    </div>

    <InventorySummaryTab
      v-if="activeTab === 'summary'"
      :overview="overview"
      :metrics="metrics"
      :format-date-time="formatDateTime"
      :get-movement-label="getMovementLabel"
      :get-movement-color="getMovementColor"
      @open-movement="openMovementModal()"
      @open-stock="activeTab = 'stock'"
      @open-movements="activeTab = 'movements'"
      @go-to-stock-from-alert="goToStockFromAlert($event)"
    />

    <InventoryStockTab
      v-if="activeTab === 'stock'"
      :stock-query="stockQuery"
      :stock-rows="stockRows"
      :overview-pending="overviewPending"
      :show-stock-branches-column="showStockBranchesColumn"
      :active-branch-ids="activeBranchIds"
      :pending-stock-receipts="pendingStockReceipts"
      :can-receive-transfer="canReceiveTransfer"
      :can-reject-transfer="canRejectTransfer"
      @update:stock-query="stockQuery = $event"
      @open-movement="openMovementModal()"
      @open-transfer="openTransferModal()"
      @receive-transfer="handleReceiveTransfer($event)"
      @reject-transfer="handleRejectTransfer($event)"
    />

    <InventoryMovementsTab
      v-if="activeTab === 'movements'"
      :movement-state="movementState"
      :movements-pending="movementsPending"
      :movement-branch-model="movementBranchModel"
      :movement-product-model="movementProductModel"
      :movement-type="movementFilters.movementType"
      :movement-date-from="movementDateFrom"
      :movement-date-to="movementDateTo"
      :movement-branch-options="movementBranchOptions"
      :movement-product-options="movementProductOptions"
      :movement-type-options="movementTypeOptions"
      :format-date-time="formatDateTime"
      :get-movement-label="getMovementLabel"
      :get-movement-color="getMovementColor"
      @update:movement-branch-model="movementBranchModel = $event"
      @update:movement-product-model="movementProductModel = $event"
      @update:movement-type="handleMovementTypeUpdate"
      @update:movement-date-from="movementDateFrom = $event"
      @update:movement-date-to="movementDateTo = $event"
      @view-details="handleViewMovementDetails($event)"
    />

    <InventoryMovementModal
      :open="movementModalOpen"
      :loading="movementLoading"
      :branches="activeBranches"
      :products="transferState?.products ?? overview?.products ?? []"
      :selected-product-id="selectedProductId ?? undefined"
      :selected-branch-id="selectedBranchId ?? undefined"
      :precheck-errors="movementPrecheckErrors"
      :precheck-normalization="movementPrecheckNormalization"
      :precheck-warnings="movementPrecheckWarnings"
      :role="actorRole"
      @update:open="movementModalOpen = $event"
      @validate="handleMovementValidate"
      @submit="handleMovementSubmit"
    />

    <InventoryTransferModal
      :open="transferModalOpen"
      :loading="transferLoading"
      :source-branches="activeBranches"
      :destination-branches="(transferState?.destinationBranches ?? transferState?.branches ?? overview?.branches ?? []).filter((branch) => branch.isActive)"
      :products="transferState?.products ?? overview?.products ?? []"
      :selected-product-id="selectedProductId ?? undefined"
      :selected-branch-id="selectedBranchId ?? undefined"
      :role="actorRole"
      :precheck-errors="transferPrecheckErrors"
      :precheck-normalization="transferPrecheckNormalization"
      :precheck-warnings="transferPrecheckWarnings"
      @update:open="transferModalOpen = $event"
      @submit="handleTransferSubmit"
    />

    <InventoryMovementDetailsModal
      :open="movementDetailsModalOpen"
      :title="movementDetailTitle"
      :movement="selectedMovementDetails"
      :transfer-details="selectedTransferDetails"
      :format-date-time="formatDateTime"
      :get-movement-label="getMovementLabel"
      @update:open="movementDetailsModalOpen = $event"
    />
  </div>
</template>
