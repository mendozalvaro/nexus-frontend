import type { Ref } from "vue";
import type {
  CatalogCategoryItem,
  CatalogCategoryPayload,
  CatalogProductItem,
  CatalogProductPayload,
  CatalogServiceItem,
  CatalogServicePayload,
} from "@/composables/useCatalog";
import type { CatalogTab } from "@/composables/catalogPage.types";

type CatalogMutationState = {
  loading: Ref<boolean>;
  error: Ref<string | null>;
};

export const useCatalogCorePage = ({
  activeTab,
  searchQuery,
  mutationState,
}: {
  activeTab: Ref<CatalogTab>;
  searchQuery: Ref<string>;
  mutationState: CatalogMutationState;
}) => {
  const { profile, ensureContext } = useUserContext();
  const { loadCapabilities } = useSubscription();
  const { ensureTenantContext, uploadCatalogImage } = useCatalogMedia();
  const { hasModuleAccess } = usePermissions();
  const {
    loadProducts,
    loadServices,
    loadCategories,
    exportCatalog,
    createProduct,
    updateProduct,
    updateProductStatus,
    createService,
    updateService,
    updateServiceStatus,
    createCategory,
    createLodgingCategory,
    updateCategory,
    updateCategoryStatus,
  } = useCatalog();

  const productModalOpen = ref(false);
  const serviceModalOpen = ref(false);
  const categoryModalOpen = ref(false);

  const editingProduct = ref<CatalogProductItem | null>(null);
  const editingService = ref<CatalogServiceItem | null>(null);
  const editingCategory = ref<CatalogCategoryItem | null>(null);

  const canViewProductCatalog = computed(() => hasModuleAccess("catalog.products"));
  const canViewServiceCatalog = computed(() => hasModuleAccess("catalog.services"));
  const shouldLoadCoreCategories = computed(() => canViewProductCatalog.value || canViewServiceCatalog.value);

  const { data: productsData, refresh: refreshProducts, pending: pendingProducts } = useAsyncData(
    "catalog-products",
    () => canViewProductCatalog.value ? loadProducts() : Promise.resolve([]),
    { server: false },
  );

  const { data: servicesData, refresh: refreshServices, pending: pendingServices } = useAsyncData(
    "catalog-services",
    () => canViewServiceCatalog.value ? loadServices() : Promise.resolve([]),
    { server: false },
  );

  const { data: categoriesData, refresh: refreshCategories, pending: pendingCategories } = useAsyncData(
    "catalog-categories",
    () => shouldLoadCoreCategories.value ? loadCategories() : Promise.resolve([]),
    { server: false },
  );

  const categoryMap = computed(() => new Map((categoriesData.value ?? []).map((category) => [category.id, category])));

  const products = computed(() =>
    (productsData.value ?? []).map((item) => ({
      ...item,
      categoryName: item.categoryId ? (categoryMap.value.get(item.categoryId)?.name ?? null) : null,
    })),
  );

  const services = computed(() =>
    (servicesData.value ?? []).map((item) => ({
      ...item,
      categoryName: item.categoryId ? (categoryMap.value.get(item.categoryId)?.name ?? null) : null,
    })),
  );

  const categories = computed(() => {
    const productsCountByCategory = new Map<string, number>();
    const servicesCountByCategory = new Map<string, number>();

    for (const product of products.value) {
      if (product.categoryId) {
        productsCountByCategory.set(product.categoryId, (productsCountByCategory.get(product.categoryId) ?? 0) + 1);
      }
    }

    for (const service of services.value) {
      if (service.categoryId) {
        servicesCountByCategory.set(service.categoryId, (servicesCountByCategory.get(service.categoryId) ?? 0) + 1);
      }
    }

    return (categoriesData.value ?? []).map((item) => ({
      ...item,
      linkedCount: item.type === "product"
        ? (productsCountByCategory.get(item.id) ?? 0)
        : (servicesCountByCategory.get(item.id) ?? 0),
    }));
  });

  const pending = computed(() => pendingProducts.value || pendingServices.value || pendingCategories.value);
  const catalog = computed(() => ({ products: products.value, services: services.value, categories: categories.value }));
  const productCategories = computed(() => catalog.value.categories.filter((category) => category.type === "product"));
  const serviceCategories = computed(() => catalog.value.categories.filter((category) => category.type === "service"));

  const filteredProducts = useCatalogSearchFilter(
    products,
    searchQuery,
    (item) => [item.name, item.sku, item.categoryName, item.description],
  );

  const filteredServices = useCatalogSearchFilter(
    services,
    searchQuery,
    (item) => [item.name, item.categoryName, item.description],
  );

  const filteredProductCategories = useCatalogSearchFilter(
    productCategories,
    searchQuery,
    (item) => [item.name, item.parentName, item.type, item.description],
  );

  const filteredServiceCategories = useCatalogSearchFilter(
    serviceCategories,
    searchQuery,
    (item) => [item.name, item.parentName, item.type, item.description],
  );

  const currentCategoryType = computed<"product" | "service" | "lodging">(() => {
    if (editingCategory.value?.type) {
      return editingCategory.value.type;
    }

    if (activeTab.value === "service-categories") {
      return "service";
    }

    if (activeTab.value === "room-categories") {
      return "lodging";
    }

    return "product";
  });

  const resolveErrorMessage = (error: unknown, fallback: string) => {
    if (
      error
      && typeof error === "object"
      && "statusMessage" in error
      && typeof (error as { statusMessage?: unknown }).statusMessage === "string"
    ) {
      return (error as { statusMessage: string }).statusMessage;
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  };

  const openProductModal = (product?: CatalogProductItem) => {
    editingProduct.value = product ?? null;
    productModalOpen.value = true;
  };

  const openServiceModal = (service?: CatalogServiceItem) => {
    editingService.value = service ?? null;
    serviceModalOpen.value = true;
  };

  const openCategoryModal = (category?: CatalogCategoryItem) => {
    editingCategory.value = category ?? null;
    categoryModalOpen.value = true;
  };

  const closeProductModal = () => {
    productModalOpen.value = false;
  };

  const closeServiceModal = () => {
    serviceModalOpen.value = false;
  };

  const closeCategoryModal = () => {
    categoryModalOpen.value = false;
  };

  const handleProductSubmit = async (payload: CatalogProductPayload) => {
    mutationState.loading.value = true;
    mutationState.error.value = null;
    try {
      const nextPayload: CatalogProductPayload = { ...payload };
      if (payload.imageFile) {
        nextPayload.imageUrl = await uploadCatalogImage(payload.imageFile, "product", {
          cropSquare: payload.cropSquare,
        });
      }
      nextPayload.imageFile = null;

      if (editingProduct.value) {
        await updateProduct(editingProduct.value.id, nextPayload);
      } else {
        await createProduct(nextPayload);
      }

      closeProductModal();
      editingProduct.value = null;
      await refreshProducts();
    } catch (error) {
      mutationState.error.value = resolveErrorMessage(error, "No se pudo crear/actualizar el producto.");
      console.error("[CATALOGO] Product submit failed:", error);
    } finally {
      mutationState.loading.value = false;
    }
  };

  const handleServiceSubmit = async (payload: CatalogServicePayload) => {
    mutationState.loading.value = true;
    mutationState.error.value = null;
    try {
      const nextPayload: CatalogServicePayload = { ...payload };
      if (payload.imageFile) {
        nextPayload.imageUrl = await uploadCatalogImage(payload.imageFile, "service", {
          cropSquare: payload.cropSquare,
        });
      }
      nextPayload.imageFile = null;

      if (editingService.value) {
        await updateService(editingService.value.id, nextPayload);
      } else {
        await createService(nextPayload);
      }

      closeServiceModal();
      editingService.value = null;
      await refreshServices();
    } catch (error) {
      mutationState.error.value = resolveErrorMessage(error, "No se pudo crear/actualizar el servicio.");
      console.error("[CATALOGO] Service submit failed:", error);
    } finally {
      mutationState.loading.value = false;
    }
  };

  const handleCategorySubmit = async (payload: CatalogCategoryPayload) => {
    mutationState.loading.value = true;
    mutationState.error.value = null;
    try {
      const categoryType = currentCategoryType.value;
      const nextPayload: CatalogCategoryPayload = {
        ...payload,
        type: categoryType,
      };

      if (editingCategory.value) {
        await updateCategory(editingCategory.value.id, nextPayload);
      } else if (nextPayload.type === "lodging") {
        await createLodgingCategory(nextPayload);
      } else {
        await createCategory(nextPayload);
      }

      closeCategoryModal();
      editingCategory.value = null;
      await refreshCategories();
    } catch (error) {
      mutationState.error.value = resolveErrorMessage(error, "No se pudo crear/actualizar la categoria.");
      console.error("[CATALOGO] Category submit failed:", error);
      return false;
    } finally {
      mutationState.loading.value = false;
    }

    return currentCategoryType.value === "lodging";
  };

  const handleToggleProductStatus = async ({ id, nextState }: { id: string; nextState: boolean }) => {
    mutationState.error.value = null;
    try {
      await updateProductStatus(id, nextState);
      await refreshProducts();
    } catch (error) {
      mutationState.error.value = resolveErrorMessage(error, "No se pudo actualizar el estado del producto.");
      console.error("[CATALOGO] Product status failed:", error);
    }
  };

  const handleToggleServiceStatus = async ({ id, nextState }: { id: string; nextState: boolean }) => {
    mutationState.error.value = null;
    try {
      await updateServiceStatus(id, nextState);
      await refreshServices();
    } catch (error) {
      mutationState.error.value = resolveErrorMessage(error, "No se pudo actualizar el estado del servicio.");
      console.error("[CATALOGO] Service status failed:", error);
    }
  };

  const handleToggleCategoryStatus = async ({ id, nextState }: { id: string; nextState: boolean }) => {
    mutationState.error.value = null;
    try {
      await updateCategoryStatus(id, nextState);
      await refreshCategories();
    } catch (error) {
      mutationState.error.value = resolveErrorMessage(error, "No se pudo actualizar el estado de la categoria.");
      console.error("[CATALOGO] Category status failed:", error);
    }
  };

  const importFlow = useCatalogImportFlow({
    activeTab,
    mutationError: mutationState.error,
    refreshProducts,
    refreshServices,
    refreshCategories,
  });

  const handleExport = async () => {
    try {
      const exportType = importFlow.resolveExportType();
      if (!exportType) {
        return;
      }

      const response = await exportCatalog(exportType);
      const blob = new Blob([response as string], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `catalogo_${activeTab.value}_${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      mutationState.error.value = error instanceof Error ? error.message : "No se pudo exportar el catalogo.";
    }
  };

  watch(
    () => productModalOpen.value,
    (open) => {
      if (!open) {
        editingProduct.value = null;
      }
    },
  );

  watch(
    () => serviceModalOpen.value,
    (open) => {
      if (!open) {
        editingService.value = null;
      }
    },
  );

  watch(
    () => categoryModalOpen.value,
    (open) => {
      if (!open) {
        editingCategory.value = null;
      }
    },
  );

  onMounted(async () => {
    await ensureContext({ requireProfile: true });
    if (profile.value?.organization_id) {
      await loadCapabilities(profile.value.organization_id);
    }
    await ensureTenantContext();
  });

  return {
    canViewProductCatalog,
    canViewServiceCatalog,
    catalog,
    categoryModalOpen,
    closeCategoryModal,
    closeProductModal,
    closeServiceModal,
    currentCategoryType,
    editingCategory,
    editingProduct,
    editingService,
    filteredProductCategories,
    filteredProducts,
    filteredServiceCategories,
    filteredServices,
    handleCategorySubmit,
    handleExport,
    handleImportClose: importFlow.handleImportClose,
    handleImportConfirm: importFlow.handleImportConfirm,
    handleImportFileSelected: importFlow.handleImportFileSelected,
    handleImportPreviewUpdateStrategy: importFlow.handleImportPreviewUpdateStrategy,
    handleOpenImport: importFlow.handleOpenImport,
    handleProductSubmit,
    handleServiceSubmit,
    handleToggleCategoryStatus,
    handleToggleProductStatus,
    handleToggleServiceStatus,
    importDownloadTemplate: importFlow.importDownloadTemplate,
    importDuplicateStrategy: importFlow.importDuplicateStrategy,
    importEntityType: importFlow.importEntityType,
    importError: importFlow.importError,
    importLoading: importFlow.importLoading,
    importModalOpen: importFlow.importModalOpen,
    importParsedData: importFlow.importParsedData,
    importPreviewResult: importFlow.importPreviewResult,
    importReset: importFlow.importReset,
    importStep: importFlow.importStep,
    importSummaryData: importFlow.importSummaryData,
    openCategoryModal,
    openProductModal,
    openServiceModal,
    pending,
    productCategories,
    productModalOpen,
    refreshCategories,
    serviceCategories,
    serviceModalOpen,
  };
};
