import type { CatalogCategoryPayload } from "@/composables/useCatalog";
import type { CatalogTab } from "@/composables/catalogPage.types";

export const useCatalogPage = () => {
  const activeTab = ref<CatalogTab>("summary");
  const searchQuery = ref("");
  const mutationLoading = ref(false);
  const mutationError = ref<string | null>(null);
  const mutationState = {
    loading: mutationLoading,
    error: mutationError,
  };

  const corePage = useCatalogCorePage({
    activeTab,
    searchQuery,
    mutationState,
  });

  const roomsPage = useCatalogRoomsPage({
    activeTab,
    searchQuery,
    mutationState,
  });

  const handleCreateForTab = () => {
    if (activeTab.value === "products") {
      corePage.openProductModal();
      return;
    }

    if (activeTab.value === "services") {
      corePage.openServiceModal();
      return;
    }

    if (
      activeTab.value === "product-categories"
      || activeTab.value === "service-categories"
      || activeTab.value === "room-categories"
    ) {
      corePage.openCategoryModal();
      return;
    }

    if (activeTab.value === "rooms") {
      roomsPage.openRoomModal();
    }
  };

  return {
    activeTab,
    branchOptions: roomsPage.branchOptions,
    canViewProductCatalog: corePage.canViewProductCatalog,
    canViewRoomCatalog: roomsPage.canViewRoomCatalog,
    canViewServiceCatalog: corePage.canViewServiceCatalog,
    catalog: corePage.catalog,
    categoryModalOpen: corePage.categoryModalOpen,
    closeCategoryModal: corePage.closeCategoryModal,
    closeProductModal: corePage.closeProductModal,
    closeServiceModal: corePage.closeServiceModal,
    currentCategoryType: corePage.currentCategoryType,
    editingCategory: corePage.editingCategory,
    editingProduct: corePage.editingProduct,
    editingRoom: roomsPage.editingRoom,
    editingService: corePage.editingService,
    filteredProductCategories: corePage.filteredProductCategories,
    filteredProducts: corePage.filteredProducts,
    filteredRoomCategories: roomsPage.filteredRoomCategories,
    filteredServices: corePage.filteredServices,
    filteredServiceCategories: corePage.filteredServiceCategories,
    handleCategorySubmit: async (payload: CatalogCategoryPayload) => {
      const shouldRefreshRooms = await corePage.handleCategorySubmit(payload);
      if (shouldRefreshRooms) {
        await roomsPage.loadLodgingCategoriesData();
      }
    },
    handleCreateForTab,
    handleExport: corePage.handleExport,
    handleImportClose: corePage.handleImportClose,
    handleImportConfirm: corePage.handleImportConfirm,
    handleImportFileSelected: corePage.handleImportFileSelected,
    handleImportPreviewUpdateStrategy: corePage.handleImportPreviewUpdateStrategy,
    handleOpenImport: corePage.handleOpenImport,
    handleProductSubmit: corePage.handleProductSubmit,
    handleRoomSubmit: roomsPage.handleRoomSubmit,
    handleServiceSubmit: corePage.handleServiceSubmit,
    handleToggleCategoryStatus: corePage.handleToggleCategoryStatus,
    handleToggleProductStatus: corePage.handleToggleProductStatus,
    handleToggleRoomStatus: roomsPage.handleToggleRoomStatus,
    handleToggleServiceStatus: corePage.handleToggleServiceStatus,
    importDownloadTemplate: corePage.importDownloadTemplate,
    importDuplicateStrategy: corePage.importDuplicateStrategy,
    importEntityType: corePage.importEntityType,
    importError: corePage.importError,
    importLoading: corePage.importLoading,
    importModalOpen: corePage.importModalOpen,
    importParsedData: corePage.importParsedData,
    importPreviewResult: corePage.importPreviewResult,
    importReset: corePage.importReset,
    importStep: corePage.importStep,
    importSummaryData: corePage.importSummaryData,
    lodgingCategories: roomsPage.lodgingCategories,
    mutationError,
    mutationLoading,
    openCategoryModal: corePage.openCategoryModal,
    openProductModal: corePage.openProductModal,
    openRoomModal: roomsPage.openRoomModal,
    openServiceModal: corePage.openServiceModal,
    pending: corePage.pending,
    pendingRooms: roomsPage.pendingRooms,
    productCategories: corePage.productCategories,
    productModalOpen: corePage.productModalOpen,
    roomCategories: roomsPage.roomCategories,
    roomModalOpen: roomsPage.roomModalOpen,
    roomsData: roomsPage.roomsData,
    searchQuery,
    serviceCategories: corePage.serviceCategories,
    serviceModalOpen: corePage.serviceModalOpen,
  };
};
