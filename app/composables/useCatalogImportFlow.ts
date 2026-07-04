import type { Ref } from "vue";
import type { CatalogTab } from "@/composables/catalogPage.types";

export const useCatalogImportFlow = ({
  activeTab,
  mutationError,
  refreshProducts,
  refreshServices,
  refreshCategories,
}: {
  activeTab: Ref<CatalogTab>;
  mutationError: Ref<string | null>;
  refreshProducts: () => Promise<unknown>;
  refreshServices: () => Promise<unknown>;
  refreshCategories: () => Promise<unknown>;
}) => {
  const importModalOpen = ref(false);

  const {
    step: importStep,
    entityType: importEntityType,
    duplicateStrategy: importDuplicateStrategy,
    parsedData: importParsedData,
    previewResult: importPreviewResult,
    importSummary: importSummaryData,
    loading: importLoading,
    error: importError,
    downloadTemplate: importDownloadTemplate,
    parseExcel: importParseExcel,
    requestPreview: importRequestPreview,
    executeImport: importExecuteImport,
    reset: importReset,
  } = useCatalogImport();

  const handleOpenImport = () => {
    importReset();
    importModalOpen.value = true;
  };

  const getExportTypeForTab = (tab: CatalogTab) => {
    if (tab === "summary") return "all" as const;
    if (tab === "products" || tab === "services") return tab;
    if (tab === "product-categories" || tab === "service-categories" || tab === "room-categories") return "categories" as const;
    return null;
  };

  const resolveExportType = () => {
    const exportType = getExportTypeForTab(activeTab.value);
    if (!exportType) {
      mutationError.value = "La exportacion de habitaciones aun no esta disponible.";
      return null;
    }

    return exportType;
  };

  const handleImportFileSelected = async (file: File) => {
    try {
      await importParseExcel(file);
      await importRequestPreview();
    } catch {
      return;
    }
  };

  const handleImportPreviewUpdateStrategy = (strategy: "upsert" | "skip") => {
    importDuplicateStrategy.value = strategy;
  };

  const handleImportConfirm = async () => {
    await importExecuteImport();
    if (importSummaryData.value) {
      await refreshProducts();
      await refreshServices();
      await refreshCategories();
    }
  };

  const handleImportClose = () => {
    importModalOpen.value = false;
    importReset();
  };

  return {
    handleImportClose,
    handleImportConfirm,
    handleImportFileSelected,
    handleImportPreviewUpdateStrategy,
    handleOpenImport,
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
    resolveExportType,
  };
};
