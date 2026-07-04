<script setup lang="ts">
import InventoryMovementModal from "@/components/inventory/modals/InventoryMovementModal.vue";
import InventoryTransferModal from "@/components/inventory/modals/InventoryTransferModal.vue";
import InventoryMovementsTab from "@/components/inventory/tabs/InventoryMovementsTab.vue";
import InventoryStockTab from "@/components/inventory/tabs/InventoryStockTab.vue";
import InventorySummaryTab from "@/components/inventory/tabs/InventorySummaryTab.vue";
import InventoryMovementDetailsModal from "@/components/inventory/modals/InventoryMovementDetailsModal.vue";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "inventory.view",
  roles: ["admin", "manager"],
  featureFlag: "feature_inventory",
  moduleKey: "inventory",
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
  allBranches,
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
  handleTransferValidate,
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

void actorRole;
void selectedBranchId;
void transferState;
</script>

<template>
  <div class="space-y-6 md:space-y-8">
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
      @open-movement="openMovementModal($event)"
      @open-transfer="openTransferModal($event)"
      @receive-transfer="handleReceiveTransfer($event)"
      @reject-transfer="handleRejectTransfer($event)"
    />

    <InventoryMovementsTab
      v-if="activeTab === 'movements'"
      :movement-state="movementState"
      :movements-pending="movementsPending"
      :movement-branch-model="movementBranchModel"
      :movement-product-model="movementProductModel"
      :movement-type="movementTypeOptions.find(opt => opt.value === movementFilters.movementType)?.value ?? 'all'"
      :movement-date-from="movementDateFrom"
      :movement-date-to="movementDateTo"
      :movement-branch-options="movementBranchOptions"
      :movement-product-options="movementProductOptions"
      :movement-type-options="movementTypeOptions"
      :format-date-time="formatDateTime"
      :get-movement-label="getMovementLabel"
      :get-movement-color="getMovementColor"
      @update:movement-branch-model="(value) => movementFilters.branchId = value === '__all__' ? null : value"
      @update:movement-product-model="(value) => movementFilters.productId = value === '__all__' ? null : value"
      @update:movement-type="(value) => movementFilters.movementType = value as any"
      @update:movement-date-from="(value) => movementFilters.dateFrom = value || null"
      @update:movement-date-to="(value) => movementFilters.dateTo = value || null"
      @view-details="handleViewMovementDetails($event)"
    />

    <InventoryMovementModal
      v-model:open="movementModalOpen"
      title="Registrar movimiento masivo"
      :branches="activeBranches"
      :initial-product-id="selectedProductId"
      :products="(overview?.products ?? []) as any"
      :loading="movementLoading"
      :role="actorRole"
      :precheck-errors="movementPrecheckErrors as any"
      :precheck-normalization="movementPrecheckNormalization as any"
      :precheck-warnings="movementPrecheckWarnings"
      @validate="handleMovementValidate($event)"
      @submit="handleMovementSubmit($event)"
    />

    <InventoryTransferModal
      v-model:open="transferModalOpen"
      title="Registrar transferencia masiva"
      :branches="activeBranches"
      :all-branches="allBranches"
      :products="overview?.products ?? []"
      :initial-product-id="selectedProductId"
      :loading="transferLoading"
      :role="actorRole"
      :precheck-errors="transferPrecheckErrors"
      :precheck-normalization="transferPrecheckNormalization"
      :precheck-warnings="transferPrecheckWarnings"
      @validate="handleTransferValidate($event)"
      @submit="handleTransferSubmit($event)"
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
