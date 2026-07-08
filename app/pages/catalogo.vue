<script setup lang="ts">
import CatalogCategoriesTable from "@/components/catalog/CatalogCategoriesTable.vue";
import CatalogCategoryModal from "@/components/catalog/CatalogCategoryModal.vue";
import CatalogImportModal from "@/components/catalog/CatalogImportModal.vue";
import CatalogImportPreview from "@/components/catalog/CatalogImportPreview.vue";
import CatalogImportSummary from "@/components/catalog/CatalogImportSummary.vue";
import CatalogProductModal from "@/components/catalog/CatalogProductModal.vue";
import CatalogProductsTable from "@/components/catalog/CatalogProductsTable.vue";
import CatalogRoomFormModal from "@/components/catalog/CatalogRoomFormModal.vue";
import CatalogRoomsTable from "@/components/catalog/CatalogRoomsTable.vue";
import CatalogServiceModal from "@/components/catalog/CatalogServiceModal.vue";
import CatalogServicesTable from "@/components/catalog/CatalogServicesTable.vue";
import CatalogSummaryPanel from "@/components/catalog/CatalogSummaryPanel.vue";
import CatalogTabs from "@/components/catalog/CatalogTabs.vue";
import CatalogToolbar from "@/components/catalog/CatalogToolbar.vue";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  moduleKey: "catalog",
  moduleKeysAny: ["catalog.products", "catalog.services", "catalog.rooms"],
  roles: ["admin", "manager"],
});

const {
  activeTab,
  branchOptions,
  canViewProductCatalog,
  canViewRoomCatalog,
  canViewServiceCatalog,
  catalog,
  closeCategoryModal,
  closeProductModal,
  closeServiceModal,
  currentCategoryType,
  editingCategory,
  editingProduct,
  editingRoom,
  editingService,
  filteredProductCategories,
  filteredProducts,
  filteredRoomCategories,
  filteredServices,
  filteredServiceCategories,
  handleCategorySubmit,
  handleCreateForTab,
  handleExport,
  handleImportClose,
  handleImportConfirm,
  handleImportFileSelected,
  handleImportPreviewUpdateStrategy,
  handleOpenImport,
  handleProductSubmit,
  handleRoomSubmit,
  handleServiceSubmit,
  handleToggleCategoryStatus,
  handleToggleProductStatus,
  handleToggleRoomStatus,
  handleToggleServiceStatus,
  importDownloadTemplate,
  importDuplicateStrategy,
  importEntityType,
  importError,
  importLoading,
  importModalOpen,
  importParsedData,
  importPreviewResult,
  importReset,
  importStep,
  importSummaryData,
  lodgingCategories,
  mutationError,
  mutationLoading,
  openProductModal,
  openServiceModal,
  openCategoryModal,
  openRoomModal,
  pending,
  pendingRooms,
  productCategories,
  productModalOpen,
  roomCategories,
  roomModalOpen,
  roomResourcesReady,
  roomsData,
  searchQuery,
  serviceCategories,
  serviceModalOpen,
  categoryModalOpen,
} = useCatalogPage();
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <ClientOnly>
      <template #fallback>
        <UCard class="rounded-[1.75rem]">
          <div class="space-y-3 py-4">
            <USkeleton class="h-10 w-full rounded-xl" />
            <USkeleton class="h-28 w-full rounded-2xl" />
            <USkeleton class="h-28 w-full rounded-2xl" />
          </div>
        </UCard>
      </template>

    <CatalogTabs
      v-model="activeTab"
      :show-products="canViewProductCatalog"
      :show-services="canViewServiceCatalog"
      :show-rooms="canViewRoomCatalog"
    />

    <UAlert
      v-if="mutationError"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :title="mutationError"
    />

    <CatalogSummaryPanel
      v-if="activeTab === 'summary' && roomResourcesReady"
      :show-products="canViewProductCatalog"
      :show-services="canViewServiceCatalog"
      :show-rooms="canViewRoomCatalog"
      :products-count="catalog.products.length"
      :product-categories-count="productCategories.length"
      :services-count="catalog.services.length"
      :service-categories-count="serviceCategories.length"
      :rooms-count="roomsData.length"
      :room-categories-count="roomCategories.length"
      @navigate="activeTab = $event"
    />

    <UCard
      v-else-if="activeTab === 'summary'"
      class="rounded-[1.75rem]"
    >
      <div class="space-y-3 py-4">
        <USkeleton class="h-10 w-full rounded-xl" />
        <USkeleton class="h-28 w-full rounded-2xl" />
        <USkeleton class="h-28 w-full rounded-2xl" />
      </div>
    </UCard>

    <template v-else>
      <CatalogToolbar
        v-if="activeTab !== 'rooms'"
        :active-tab="activeTab as 'products' | 'product-categories' | 'services' | 'service-categories' | 'room-categories'"
        :search-query="searchQuery"
        :products-count="filteredProducts.length"
        :product-categories-count="filteredProductCategories.length"
        :services-count="filteredServices.length"
        :service-categories-count="filteredServiceCategories.length"
        :room-categories-count="filteredRoomCategories.length"
        @update:search-query="searchQuery = $event"
        @create="handleCreateForTab"
        @import="handleOpenImport"
        @export="handleExport"
      />

      <CatalogProductsTable
        v-if="activeTab === 'products'"
        :rows="filteredProducts"
        :loading="pending || mutationLoading"
        @edit="openProductModal"
        @toggle-status="handleToggleProductStatus"
      />

      <CatalogServicesTable
        v-else-if="activeTab === 'services'"
        :rows="filteredServices"
        :loading="pending || mutationLoading"
        @edit="openServiceModal"
        @toggle-status="handleToggleServiceStatus"
      />

      <CatalogCategoriesTable
        v-else-if="activeTab === 'product-categories'"
        :rows="filteredProductCategories"
        :loading="pending || mutationLoading"
        @edit="openCategoryModal"
        @toggle-status="handleToggleCategoryStatus"
      />

      <CatalogCategoriesTable
        v-else-if="activeTab === 'service-categories'"
        :rows="filteredServiceCategories"
        :loading="pending || mutationLoading"
        @edit="openCategoryModal"
        @toggle-status="handleToggleCategoryStatus"
      />

      <CatalogCategoriesTable
        v-else-if="activeTab === 'room-categories'"
        :rows="filteredRoomCategories"
        :loading="pending || mutationLoading"
        @edit="openCategoryModal"
        @toggle-status="handleToggleCategoryStatus"
      />

      <template v-if="activeTab === 'rooms'">
        <div class="flex justify-end">
          <UButton color="primary" icon="i-lucide-plus" @click="() => openRoomModal()">
            Nueva habitacion
          </UButton>
        </div>

        <CatalogRoomsTable
          :rows="roomsData"
          :loading="pendingRooms || mutationLoading"
          @edit="openRoomModal"
          @toggle-status="handleToggleRoomStatus"
        />
      </template>
    </template>

    <CatalogProductModal
      :open="productModalOpen"
      :loading="mutationLoading"
      :categories="productCategories"
      :initial-value="editingProduct"
      @update:open="productModalOpen = $event"
      @submit="handleProductSubmit"
      @cancel="closeProductModal"
    />

    <CatalogServiceModal
      :open="serviceModalOpen"
      :loading="mutationLoading"
      :categories="serviceCategories"
      :initial-value="editingService"
      @update:open="serviceModalOpen = $event"
      @submit="handleServiceSubmit"
      @cancel="closeServiceModal"
    />

    <CatalogCategoryModal
      :open="categoryModalOpen"
      :loading="mutationLoading"
      :type="currentCategoryType"
      :categories="activeTab === 'room-categories' ? roomCategories : activeTab === 'service-categories' ? serviceCategories : productCategories"
      :initial-value="editingCategory"
      @update:open="categoryModalOpen = $event"
      @submit="handleCategorySubmit"
      @cancel="closeCategoryModal"
    />

    <CatalogRoomFormModal
      :open="roomModalOpen"
      :loading="mutationLoading"
      :initial-value="editingRoom"
      :lodging-categories="lodgingCategories"
      :branches="branchOptions"
      @update:open="roomModalOpen = $event"
      @submit="handleRoomSubmit"
    />

    <UModal v-model:open="importModalOpen" :title="'Importar datos al catalogo'" class="max-w-2xl">
      <template #body>
        <div class="space-y-6">
          <CatalogImportModal
            v-if="importStep === 'select'"
            :entity-type="importEntityType"
            :duplicate-strategy="importDuplicateStrategy"
            :loading="importLoading"
            :error="importError"
            @update:entity-type="importEntityType = $event"
            @update:duplicate-strategy="importDuplicateStrategy = $event"
            @file-selected="handleImportFileSelected"
            @download-template="importDownloadTemplate(importEntityType)"
          />

          <CatalogImportPreview
            v-if="importStep === 'preview' && importPreviewResult"
            :preview-result="importPreviewResult"
            :total-rows="importParsedData?.rows.length ?? 0"
            :duplicate-strategy="importDuplicateStrategy"
            @update:duplicate-strategy="handleImportPreviewUpdateStrategy"
          />

          <CatalogImportSummary
            v-if="importStep === 'summary' && importSummaryData"
            :summary="importSummaryData"
          />

          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" color="neutral" @click="handleImportClose">
              {{ importStep === "summary" ? "Cerrar" : "Cancelar" }}
            </UButton>

            <UButton
              v-if="importStep === 'preview'"
              color="primary"
              :loading="importLoading"
              :disabled="(importPreviewResult?.invalidRows ?? 0) > 0 && (importPreviewResult?.validRows ?? 0) === 0"
              @click="handleImportConfirm"
            >
              Importar
            </UButton>

            <UButton
              v-if="importStep === 'preview' && importPreviewResult && importPreviewResult.validRows === 0"
              variant="ghost"
              color="neutral"
              @click="importReset(); importModalOpen = false;"
            >
              Volver a seleccionar
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
    </ClientOnly>
  </div>
</template>
