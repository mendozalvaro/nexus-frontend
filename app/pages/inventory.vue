<script setup lang="ts">
import type {
  InventoryAdjustmentPayload,
  InventoryMovementFilters,
  InventoryTransferPayload,
} from "@/composables/useInventory";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "inventory.view",
  roles: ["admin", "manager"],
  featureFlag: "feature_inventory",
  requiresBranch: true,
});

const activeTab = ref<"summary" | "stock" | "movements">("summary");
const stockQuery = ref("");
const movementModalOpen = ref(false);
const movementLoading = ref(false);
const selectedProductId = ref<string | null>(null);

const {
  loadOverview,
  loadAdjustmentsPage,
  createDefaultMovementFilters,
  adjustStock,
  transferStock,
  formatDateTime,
  getMovementLabel,
  getMovementColor,
} = useInventory();

const movementFilters = reactive<InventoryMovementFilters>(createDefaultMovementFilters());

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

const { data: overviewData, pending: overviewPending, refresh: refreshOverview } = await useAsyncData(
  "inventory-overview",
  () => loadOverview(),
  { server: false },
);

const { data: movementsData, pending: movementsPending, refresh: refreshMovements } = await useAsyncData(
  "inventory-movements",
  () => loadAdjustmentsPage({ ...movementFilters }),
  {
    server: false,
    watch: [
      () => movementFilters.branchId,
      () => movementFilters.productId,
      () => movementFilters.movementType,
      () => movementFilters.dateFrom,
      () => movementFilters.dateTo,
    ],
  },
);

const overview = computed(() => overviewData.value);
const movementState = computed(() => movementsData.value);
const stockRows = computed(() => {
  const rows = overview.value?.products ?? [];
  const query = stockQuery.value.trim().toLowerCase();

  if (!query) {
    return rows;
  }

  return rows.filter((row) => {
    return [
      row.name,
      row.sku ?? "",
      row.categoryName ?? "",
      row.description ?? "",
    ].some((value) => value.toLowerCase().includes(query));
  });
});

const metrics = computed(() => {
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
      label: "Movimientos hoy",
      value: overview.value.metrics.movementsToday,
      icon: "i-lucide-arrow-left-right",
      iconClass: "text-violet-600 dark:text-violet-300",
      iconWrapperClass: "bg-violet-100 dark:bg-violet-950/50",
    },
  ];
});

const openMovementModal = (productId?: string) => {
  selectedProductId.value = productId ?? null;
  movementModalOpen.value = true;
};

const handleMovementSubmit = async (
  input: {
    kind: "entry" | "exit" | "adjustment" | "transfer";
    payload: InventoryAdjustmentPayload | InventoryTransferPayload;
  },
) => {
  movementLoading.value = true;

  try {
    if (input.kind === "transfer") {
      await transferStock(input.payload as InventoryTransferPayload);
    } else {
      await adjustStock(input.payload as InventoryAdjustmentPayload);
    }

    movementModalOpen.value = false;
    await Promise.all([refreshOverview(), refreshMovements()]);
  } finally {
    movementLoading.value = false;
  }
};

const goToStockFromAlert = (productId: string) => {
  activeTab.value = "stock";
  selectedProductId.value = productId;
  stockQuery.value = overview.value?.products.find((product) => product.id === productId)?.name ?? "";
};
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiModuleHero
      eyebrow="Operacion"
      title="Inventario"
      description="Controla existencias, registra movimientos y sigue alertas de stock sin mezclar configuracion comercial con operacion diaria."
      icon="i-lucide-boxes"
    >
      <template #actions>
        <UButton color="primary" icon="i-lucide-package-plus" @click="openMovementModal()">
          Registrar movimiento
        </UButton>
      </template>
    </UiModuleHero>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiStatCard
        v-for="item in metrics"
        :key="item.label"
        :label="item.label"
        :value="item.value"
        :icon="item.icon"
        :icon-class="item.iconClass"
        :icon-wrapper-class="item.iconWrapperClass"
      />
    </div>

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

    <UiSectionShell
      v-if="activeTab === 'summary'"
      eyebrow="Resumen"
      title="Senales clave del inventario"
      description="Detecta rapido quiebres, movimientos recientes y prioridades para reponer o ajustar."
    >
      <div class="mb-4 flex justify-end">
        <UButton color="primary" variant="soft" icon="i-lucide-box" @click="activeTab = 'stock'">
          Ir a stock
        </UButton>
      </div>

      <div class="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
        <UCard class="rounded-[1.5rem] border-slate-200/80 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:shadow-black/20">
          <template #header>
            <div class="space-y-1">
              <h3 class="text-lg font-semibold text-slate-950 dark:text-white">
                Alertas de stock
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Productos que requieren decision rapida en sucursal.
              </p>
            </div>
          </template>

          <div class="space-y-3">
            <div
              v-for="alert in overview?.lowStock.slice(0, 6) ?? []"
              :key="`${alert.productId}:${alert.branchId}`"
              class="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p class="font-medium text-slate-950 dark:text-white">
                  {{ alert.productName }}
                </p>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  {{ alert.branchName }} - Disponible {{ alert.availableQuantity }} / Minimo {{ alert.minStockLevel }}
                </p>
              </div>
              <UButton color="warning" variant="soft" @click="goToStockFromAlert(alert.productId)">
                Ajustar en stock
              </UButton>
            </div>

            <p v-if="(overview?.lowStock.length ?? 0) === 0" class="text-sm text-slate-500 dark:text-slate-400">
              No hay alertas activas de inventario.
            </p>
          </div>
        </UCard>

        <UCard class="rounded-[1.5rem] border-slate-200/80 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:shadow-black/20">
          <template #header>
            <div class="space-y-1">
              <h3 class="text-lg font-semibold text-slate-950 dark:text-white">
                Movimientos recientes
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Ultima actividad visible del inventario.
              </p>
            </div>
          </template>

          <div class="space-y-3">
            <div
              v-for="movement in overview?.recentMovements ?? []"
              :key="movement.id"
              class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70"
            >
              <div class="flex items-center justify-between gap-3">
                <p class="font-medium text-slate-950 dark:text-white">
                  {{ movement.productName }}
                </p>
                <UBadge :color="getMovementColor(movement.movementType)" variant="soft">
                  {{ getMovementLabel(movement.movementType) }}
                </UBadge>
              </div>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {{ movement.branchName }} - {{ movement.previousQuantity }} -> {{ movement.newQuantity }}
              </p>
              <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {{ formatDateTime(movement.createdAt) }}
              </p>
            </div>

            <p v-if="(overview?.recentMovements.length ?? 0) === 0" class="text-sm text-slate-500 dark:text-slate-400">
              No hubo movimientos registrados hoy.
            </p>
          </div>
        </UCard>
      </div>
    </UiSectionShell>

    <UiSectionShell
      v-if="activeTab === 'stock'"
      eyebrow="Stock"
      title="Productos operativos"
      description="Una vista por producto con resumen por sucursal para decidir ingresos, salidas, ajustes y transferencias."
    >
      <UiSearchFilters title="Buscar producto" description="Filtra por nombre, SKU o categoria." surface>
        <template #controls>
          <UInput v-model="stockQuery" icon="i-lucide-search" placeholder="Buscar en inventario" :ui="{ base: 'min-h-11 text-base' }" />
        </template>
        <template #summary>
          {{ stockRows.length }} producto(s)
        </template>
      </UiSearchFilters>

      <InventoryStockTable
        :rows="stockRows"
        :loading="overviewPending"
        @move="openMovementModal($event.id)"
      />
    </UiSectionShell>

    <UiSectionShell
      v-if="activeTab === 'movements'"
      eyebrow="Trazabilidad"
      title="Historial de movimientos"
      description="Consulta entradas, salidas, ajustes y transferencias con filtros operativos."
    >
      <UiSearchFilters title="Filtros" description="Acota el historial por sucursal, producto, tipo y fecha." surface>
        <template #controls>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <select v-model="movementFilters.branchId" class="min-h-10 w-full bg-transparent text-sm outline-none">
                <option :value="null">Todas las sucursales</option>
                <option v-for="branch in movementState?.branches ?? overview?.branches ?? []" :key="branch.id" :value="branch.id">
                  {{ branch.name }}
                </option>
              </select>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <select v-model="movementFilters.productId" class="min-h-10 w-full bg-transparent text-sm outline-none">
                <option :value="null">Todos los productos</option>
                <option v-for="product in movementState?.products ?? overview?.products ?? []" :key="product.id" :value="product.id">
                  {{ product.name }}
                </option>
              </select>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <select v-model="movementFilters.movementType" class="min-h-10 w-full bg-transparent text-sm outline-none">
                <option value="all">Todos los tipos</option>
                <option value="entry">Ingreso</option>
                <option value="exit">Salida</option>
                <option value="adjustment">Ajuste</option>
                <option value="transfer_in">Transferencia entrada</option>
                <option value="transfer_out">Transferencia salida</option>
              </select>
            </div>
            <UInput v-model="movementDateFrom" type="date" :ui="{ base: 'min-h-11 text-base' }" />
            <UInput v-model="movementDateTo" type="date" :ui="{ base: 'min-h-11 text-base' }" />
          </div>
        </template>
        <template #summary>
          {{ movementState?.movements.length ?? 0 }} movimiento(s)
        </template>
      </UiSearchFilters>

      <InventoryMovementTable
        :rows="movementState?.movements ?? []"
        :loading="movementsPending"
        :format-date-time="formatDateTime"
        :get-movement-label="getMovementLabel"
        :get-movement-color="getMovementColor"
      />
    </UiSectionShell>

    <InventoryMovementModal
      :open="movementModalOpen"
      :loading="movementLoading"
      :branches="movementState?.branches ?? overview?.branches ?? []"
      :products="movementState?.products ?? overview?.products ?? []"
      :transfer-enabled="movementState?.transferEnabled ?? overview?.transferEnabled ?? false"
      :selected-product-id="selectedProductId ?? undefined"
      @update:open="movementModalOpen = $event"
      @submit="handleMovementSubmit"
    />
  </div>
</template>

