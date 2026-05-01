import type {
  InventoryAdjustmentBatchLine,
  InventoryAdjustmentBatchPayload,
  InventoryBatchNormalization,
  InventoryBatchValidationError,
  InventoryHistoryData,
  InventoryMovementFilters,
  InventoryMovementRowView,
  InventoryOverviewData,
  InventoryProductRowView,
  InventoryTransferBatchLine,
  InventoryTransferBatchPayload,
  InventoryTransferDetailData,
  InventoryTransferRowView,
} from "@/composables/useInventory";

export type InventoryTab = "summary" | "stock" | "movements";

export interface InventoryMetricCard {
  label: string;
  value: number;
  icon: string;
  iconClass: string;
  iconWrapperClass: string;
}

export const useInventoryPage = () => {
  const toast = useToast();
  const inventoryProfileReady = useState<boolean>("inventory:profile-ready", () => false);
  const activeTab = ref<InventoryTab>("summary");
  const stockQuery = ref("");

  const movementModalOpen = ref(false);
  const transferModalOpen = ref(false);
  const movementLoading = ref(false);
  const transferLoading = ref(false);
  const selectedProductId = ref<string | null>(null);

  const movementDetailsModalOpen = ref(false);
  const selectedMovementDetails = ref<InventoryMovementRowView | null>(null);
  const selectedTransferDetails = ref<InventoryTransferDetailData | null>(null);

  const movementPrecheckErrors = ref<InventoryBatchValidationError[]>([]);
  const transferPrecheckErrors = ref<InventoryBatchValidationError[]>([]);
  const movementPrecheckNormalization = ref<InventoryBatchNormalization<InventoryAdjustmentBatchLine> | null>(null);
  const transferPrecheckNormalization = ref<InventoryBatchNormalization<InventoryTransferBatchLine> | null>(null);
  const movementPrecheckWarnings = ref<string[]>([]);
  const transferPrecheckWarnings = ref<string[]>([]);

  const {
    loadOverview,
    loadTransfersPage,
    loadHistoryPage,
    createDefaultMovementFilters,
    precheckAdjustStockBatch,
    adjustStockBatch,
    precheckTransferStockBatch,
    transferStockBatch,
    receiveTransfer,
    receiveTransferBatch,
    rejectTransfer,
    rejectTransferBatch,
    loadTransferDetails,
    formatDateTime,
    getMovementLabel,
    getMovementColor,
  } = useInventory();
  const { user, profile, ensureContext } = useUserContext();
  const { selectedBranchId } = useModuleBranchContext("inventory");

  const actorRole = computed<"admin" | "manager">(() => (profile.value?.role === "admin" ? "admin" : "manager"));
  const ensureProfileReady = async () => {
    if (inventoryProfileReady.value && profile.value) {
      return profile.value;
    }

    const { profile: nextProfile } = await ensureContext({ requireProfile: true });
    inventoryProfileReady.value = Boolean(nextProfile);
    return nextProfile;
  };

  watch(
    () => user.value?.id ?? null,
    () => {
      inventoryProfileReady.value = false;
    },
  );

  const inventoryScopeKey = computed(() => `${user.value?.id ?? "anon"}:${profile.value?.organization_id ?? "none"}:${profile.value?.role ?? "none"}:${selectedBranchId.value ?? "none"}`);
  const overviewAsyncKey = computed(() => `inventory-overview:${inventoryScopeKey.value}`);
  const transfersAsyncKey = computed(() => `inventory-transfers:${inventoryScopeKey.value}`);
  const movementsAsyncKey = computed(() => `inventory-movements:${inventoryScopeKey.value}`);

  const movementFilters = reactive<InventoryMovementFilters>(createDefaultMovementFilters());

  watch(
    () => selectedBranchId.value,
    (branchId) => {
      movementFilters.branchId = branchId;
    },
    { immediate: true },
  );

  const movementDateFrom = computed({
    get: () => movementFilters.dateFrom ?? "",
    set: (value: string) => {
      movementFilters.dateFrom = value || null;
    },
  });

  const movementDateTo = computed({
    get: () => movementFilters.dateTo ?? "",
    set: (value: string) => {
      movementFilters.dateTo = value || null;
    },
  });

  const { data: overviewData, pending: overviewPending, refresh: refreshOverview } = useAsyncData(
    overviewAsyncKey,
    async () => {
      await ensureProfileReady();
      return loadOverview();
    },
    {
      server: false,
      watch: [inventoryScopeKey],
    },
  );

  const { data: transfersData, refresh: refreshTransfers } = useAsyncData(
    transfersAsyncKey,
    async () => {
      await ensureProfileReady();
      return loadTransfersPage({
        status: "pending",
        branchId: selectedBranchId.value,
      }, { includeProducts: false });
    },
    {
      server: false,
      immediate: false,
      default: () => null,
    },
  );

  const { data: movementsData, pending: movementsPending, refresh: refreshMovements } = useAsyncData(
    movementsAsyncKey,
    async () => {
      await ensureProfileReady();
      return loadHistoryPage({ ...movementFilters });
    },
    {
      server: false,
      immediate: false,
      default: () => null,
    },
  );

  watch(
    () => [activeTab.value, inventoryScopeKey.value] as const,
    async ([tab]) => {
      if (tab !== "stock") {
        return;
      }

      await refreshTransfers();
    },
    { immediate: true },
  );

  watch(
    () => [
      activeTab.value,
      inventoryScopeKey.value,
      movementFilters.branchId,
      movementFilters.productId,
      movementFilters.movementType,
      movementFilters.dateFrom,
      movementFilters.dateTo,
    ] as const,
    async ([tab]) => {
      if (tab !== "movements") {
        return;
      }

      await refreshMovements();
    },
    { immediate: true },
  );

  const overview = computed<InventoryOverviewData | null>(() => overviewData.value ?? null);
  const transferState = computed(() => transfersData.value);
  const movementState = computed<InventoryHistoryData | null>(() => movementsData.value ?? null);
  const activeBranches = computed(() => (overview.value?.branches ?? []).filter((branch) => branch.isActive));
  const activeBranchIds = computed(() => activeBranches.value.map((branch) => branch.id));
  const showStockBranchesColumn = computed(() => activeBranchIds.value.length > 1);

  const stockRows = computed<InventoryProductRowView[]>(() => {
    const allRows = overview.value?.products ?? [];
    const rows = actorRole.value === "admin"
      ? allRows
      : allRows.filter((row) => row.totalQuantity > 0);

    const query = stockQuery.value.trim().toLowerCase();
    if (!query) {
      return rows;
    }

    return rows.filter((row) => [row.name, row.sku ?? "", row.categoryName ?? ""].some((value) => value.toLowerCase().includes(query)));
  });

  const movementBranchModel = computed<string>({
    get: () => movementFilters.branchId ?? "__all__",
    set: (value) => {
      movementFilters.branchId = value === "__all__" ? null : value;
    },
  });

  const movementProductModel = computed<string>({
    get: () => movementFilters.productId ?? "__all__",
    set: (value) => {
      movementFilters.productId = value === "__all__" ? null : value;
    },
  });

  const movementTypeOptions = [
    { label: "Todos los tipos", value: "all" },
    { label: "Ingreso", value: "entry" },
    { label: "Salida", value: "exit" },
    { label: "Ajuste", value: "adjustment" },
    { label: "Transferencia enviada", value: "transfer_out" },
    { label: "Transferencia recibida", value: "transfer_in" },
  ];

  const movementBranchOptions = computed(() => [
    { label: "Todas las sucursales", value: "__all__" },
    ...(movementState.value?.branches ?? activeBranches.value).map((branch) => ({
      label: branch.code ? `${branch.name} (${branch.code})` : branch.name,
      value: branch.id,
    })),
  ]);

  const movementProductOptions = computed(() => [
    { label: "Todos los productos", value: "__all__" },
    ...(movementState.value?.products ?? overview.value?.products ?? []).map((product) => ({
      label: product.sku ? `${product.name} (${product.sku})` : product.name,
      value: product.id,
    })),
  ]);

  const pendingStockReceipts = computed(() => {
    const pending = (transferState.value?.transfers ?? []).filter((row) => row.status === "pending");
    if (actorRole.value === "admin") {
      return pending.slice(0, 8);
    }

    if (!selectedBranchId.value) {
      return [];
    }

    return pending.filter((row) => row.destinationBranchId === selectedBranchId.value).slice(0, 8);
  });

  const metrics = computed<InventoryMetricCard[]>(() => {
    if (!overview.value) {
      return [];
    }

    return [
      {
        label: "Productos",
        value: overview.value.metrics.totalProducts,
        icon: "i-lucide-package-search",
        iconClass: "text-sky-600 dark:text-sky-300",
        iconWrapperClass: "bg-sky-100 dark:bg-sky-950/50",
      },
      {
        label: "Unidades",
        value: overview.value.metrics.totalUnits,
        icon: "i-lucide-boxes",
        iconClass: "text-emerald-600 dark:text-emerald-300",
        iconWrapperClass: "bg-emerald-100 dark:bg-emerald-950/50",
      },
      {
        label: "Alertas",
        value: overview.value.metrics.lowStockItems,
        icon: "i-lucide-triangle-alert",
        iconClass: "text-amber-600 dark:text-amber-300",
        iconWrapperClass: "bg-amber-100 dark:bg-amber-950/50",
      },
      {
        label: "Transferencias pendientes",
        value: transferState.value?.pendingInboundCount ?? 0,
        icon: "i-lucide-arrow-left-right",
        iconClass: "text-violet-600 dark:text-violet-300",
        iconWrapperClass: "bg-violet-100 dark:bg-violet-950/50",
      },
    ];
  });

  const openMovementModal = (productId?: string) => {
    selectedProductId.value = productId ?? null;
    movementPrecheckErrors.value = [];
    movementPrecheckNormalization.value = null;
    movementPrecheckWarnings.value = [];
    movementModalOpen.value = true;
  };

  const openTransferModal = (productId?: string) => {
    selectedProductId.value = productId ?? null;
    transferPrecheckErrors.value = [];
    transferPrecheckNormalization.value = null;
    transferPrecheckWarnings.value = [];
    transferModalOpen.value = true;
  };

  const canReceiveTransfer = (row: InventoryTransferRowView) => {
    if (row.status !== "pending") return false;
    if (actorRole.value === "admin") return true;
    if (!selectedBranchId.value) return false;
    return row.destinationBranchId === selectedBranchId.value;
  };

  const canRejectTransfer = (row: InventoryTransferRowView) => {
    if (row.status !== "pending") return false;
    if (actorRole.value === "admin") return true;
    if (!selectedBranchId.value) return false;
    return row.destinationBranchId === selectedBranchId.value;
  };

  const handleMovementValidate = async (payload: InventoryAdjustmentBatchPayload) => {
    movementLoading.value = true;

    try {
      const precheck = await precheckAdjustStockBatch(payload);
      movementPrecheckErrors.value = precheck.errors ?? [];
      movementPrecheckNormalization.value = precheck.normalization ?? null;
      movementPrecheckWarnings.value = precheck.warnings ?? [];

      if (precheck.isValid) {
        toast.add({
          title: "Validacion completada",
          description: "No se encontraron errores. Puedes registrar el lote.",
          color: "success",
        });
      }
    } finally {
      movementLoading.value = false;
    }
  };

  const handleMovementSubmit = async (payload: InventoryAdjustmentBatchPayload) => {
    movementLoading.value = true;

    try {
      const result = await adjustStockBatch(payload);
      movementModalOpen.value = false;
      movementPrecheckErrors.value = [];
      movementPrecheckNormalization.value = null;
      movementPrecheckWarnings.value = [];
      toast.add({
        title: "Movimiento realizado",
        description: `Se registraron ${result.processedCount} linea(s) en el lote.`,
        color: "success",
      });
      const refreshTasks: Array<Promise<unknown>> = [refreshOverview()];
      if (activeTab.value === "stock" || transferState.value) {
        refreshTasks.push(refreshTransfers());
      }
      if (activeTab.value === "movements" || movementState.value) {
        refreshTasks.push(refreshMovements());
      }
      await Promise.all(refreshTasks);
    } finally {
      movementLoading.value = false;
    }
  };

  const handleTransferSubmit = async (payload: InventoryTransferBatchPayload) => {
    transferLoading.value = true;

    try {
      const precheck = await precheckTransferStockBatch(payload);
      transferPrecheckErrors.value = precheck.errors ?? [];
      transferPrecheckNormalization.value = precheck.normalization ?? null;
      transferPrecheckWarnings.value = precheck.warnings ?? [];

      if (!precheck.isValid) {
        return;
      }

      const result = await transferStockBatch(payload);
      transferModalOpen.value = false;
      transferPrecheckErrors.value = [];
      transferPrecheckNormalization.value = null;
      transferPrecheckWarnings.value = [];
      toast.add({
        title: "Transferencia creada",
        description: `Se registraron ${result.processedCount} linea(s) para transferencia.`,
        color: "success",
      });
      const refreshTasks: Array<Promise<unknown>> = [refreshOverview()];
      if (activeTab.value === "stock" || transferState.value) {
        refreshTasks.push(refreshTransfers());
      }
      if (activeTab.value === "movements" || movementState.value) {
        refreshTasks.push(refreshMovements());
      }
      await Promise.all(refreshTasks);
    } finally {
      transferLoading.value = false;
    }
  };

  const handleReceiveTransfer = async (row: InventoryTransferRowView) => {
    transferLoading.value = true;
    try {
      if (row.isBatch) {
        await receiveTransferBatch(row.id);
      } else {
        await receiveTransfer(row.id);
      }
      toast.add({
        title: "Transferencia recepcionada",
        description: row.internalNote ?? `${row.sourceBranchCode} -> ${row.destinationBranchCode}`,
        color: "success",
      });
      const refreshTasks: Array<Promise<unknown>> = [refreshOverview()];
      if (activeTab.value === "stock" || transferState.value) {
        refreshTasks.push(refreshTransfers());
      }
      if (activeTab.value === "movements" || movementState.value) {
        refreshTasks.push(refreshMovements());
      }
      await Promise.all(refreshTasks);
    } finally {
      transferLoading.value = false;
    }
  };

  const handleRejectTransfer = async (row: InventoryTransferRowView) => {
    transferLoading.value = true;
    try {
      if (row.isBatch) {
        await rejectTransferBatch(row.id);
      } else {
        await rejectTransfer(row.id);
      }
      toast.add({
        title: "Transferencia rechazada",
        description: row.internalNote ?? `${row.sourceBranchCode} -> ${row.destinationBranchCode}`,
        color: "warning",
      });
      const refreshTasks: Array<Promise<unknown>> = [refreshOverview()];
      if (activeTab.value === "stock" || transferState.value) {
        refreshTasks.push(refreshTransfers());
      }
      if (activeTab.value === "movements" || movementState.value) {
        refreshTasks.push(refreshMovements());
      }
      await Promise.all(refreshTasks);
    } finally {
      transferLoading.value = false;
    }
  };

  const handleViewMovementDetails = async (row: InventoryMovementRowView) => {
    selectedMovementDetails.value = row;
    selectedTransferDetails.value = null;

    if ((row.movementType === "transfer_in" || row.movementType === "transfer_out") && row.referenceId) {
      try {
        const transferResponse = await loadTransferDetails(row.referenceId);
        selectedTransferDetails.value = transferResponse.details;
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo cargar el detalle de la transferencia.";
        toast.add({
          title: "Detalle incompleto",
          description: message,
          color: "warning",
        });
      }
    }

    movementDetailsModalOpen.value = true;
  };

  const movementDetailTitle = computed(() => {
    const movement = selectedMovementDetails.value;
    if (!movement) return "Detalle de movimiento";
    const code = movement.note ?? "--";
    if (movement.movementType === "entry") return `Nota de Ingreso ${code}`;
    if (movement.movementType === "exit") return `Nota de Salida ${code}`;
    if (movement.movementType === "adjustment") return `Nota de Ajuste ${code}`;
    return `Nota de Transferencia ${code}`;
  });

  const goToStockFromAlert = (productId: string) => {
    activeTab.value = "stock";
    selectedProductId.value = productId;
    stockQuery.value = overview.value?.products.find((product) => product.id === productId)?.name ?? "";
  };

  return {
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
  };
};
