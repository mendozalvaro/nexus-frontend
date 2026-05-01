<script setup lang="ts">
import { normalizeInventoryTransferBatchLines } from "@/composables/useInventory";

import type {
  InventoryBatchNormalization,
  InventoryBatchValidationError,
  InventoryBranchOption,
  InventoryProductRowView,
  InventoryRole,
  InventoryTransferBatchLine,
  InventoryTransferBatchPayload,
} from "@/composables/useInventory";

interface TransferLineState {
  id: string;
  productId: string;
  quantity: number;
}

interface TransferFormState {
  sourceBranchId: string;
  destinationBranchId: string;
  observations: string;
}

const props = withDefaults(defineProps<{
  open: boolean;
  loading?: boolean;
  sourceBranches: InventoryBranchOption[];
  destinationBranches: InventoryBranchOption[];
  products: InventoryProductRowView[];
  selectedBranchId?: string | null;
  selectedProductId?: string | null;
  role?: InventoryRole;
  precheckErrors?: InventoryBatchValidationError[];
  precheckNormalization?: InventoryBatchNormalization<InventoryTransferBatchLine> | null;
  precheckWarnings?: string[];
}>(), {
  loading: false,
  selectedBranchId: null,
  selectedProductId: null,
  role: "admin",
  precheckErrors: () => [],
  precheckNormalization: null,
  precheckWarnings: () => [],
});

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [InventoryTransferBatchPayload];
}>();

const state = reactive<TransferFormState>({
  sourceBranchId: "",
  destinationBranchId: "",
  observations: "",
});

const lines = ref<TransferLineState[]>([]);

const activeProducts = computed(() => props.products.filter((product) => product.isActive));

const sourceBranchOptions = computed(() =>
  props.sourceBranches.map((branch) => ({
    label: branch.code ? `${branch.name} (${branch.code})` : branch.name,
    value: branch.id,
  })));

const managerShowsSourceBranchSelect = computed(() =>
  props.role === "manager" && props.sourceBranches.length > 1);

const managerSingleSourceBranch = computed(() =>
  props.role === "manager" ? props.sourceBranches[0] ?? null : null);

const availableDestinations = computed(() =>
  props.destinationBranches.filter((branch) => branch.id !== state.sourceBranchId));

const destinationBranchOptions = computed(() =>
  availableDestinations.value.map((branch) => ({
    label: branch.code ? `${branch.name} (${branch.code})` : branch.name,
    value: branch.id,
  })));

const productOptions = computed(() =>
  activeProducts.value.map((product) => ({
    label: product.sku ? `${product.name} (${product.sku})` : product.name,
    value: product.id,
  })));

const productsMap = computed(() => new Map(props.products.map((product) => [product.id, product])));

const getAvailableQuantity = (productId: string): number => {
  if (!productId || !state.sourceBranchId) return 0;

  const product = productsMap.value.get(productId);
  if (!product) return 0;

  const stock = product.stockByBranch.find((item) => item.branchId === state.sourceBranchId);
  return stock?.availableQuantity ?? 0;
};

const draftLines = computed<InventoryTransferBatchLine[]>(() =>
  lines.value.map((line) => ({
    productId: line.productId,
    quantity: Number(line.quantity) || 0,
  })));

const localNormalization = computed(() =>
  normalizeInventoryTransferBatchLines(draftLines.value));

const localWarnings = computed(() => {
  if (localNormalization.value.mergedProducts <= 0) return [];
  const mergedLines = localNormalization.value.originalLines - localNormalization.value.normalizedLines;
  return [`Se consolidaran ${mergedLines} linea(s) repetidas automaticamente.`];
});

const detailedPrecheckErrors = computed(() => {
  return props.precheckErrors.map((error) => {
    const product = error.productId ? productsMap.value.get(error.productId) : null;
    const productLabel = product
      ? `${product.name}${product.sku ? ` (${product.sku})` : ""}`
      : (error.productId ?? "Producto desconocido");

    return {
      ...error,
      productLabel,
      lineLabel: `Linea normalizada ${error.lineIndex}`,
    };
  });
});

const localValidationErrors = computed(() => {
  const errors: string[] = [];

  for (const [index, line] of lines.value.entries()) {
    const lineNumber = index + 1;
    if (!line.productId) {
      errors.push(`Linea ${lineNumber}: selecciona un producto.`);
      continue;
    }

    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      errors.push(`Linea ${lineNumber}: la cantidad debe ser un entero mayor a cero.`);
      continue;
    }

    const available = getAvailableQuantity(line.productId);
    if (quantity > available) {
      errors.push(`Linea ${lineNumber}: cantidad ${quantity} excede disponible (${available}).`);
    }
  }

  return errors;
});

const addLine = (initialProductId?: string | null) => {
  const fallbackProductId = activeProducts.value[0]?.id ?? "";
  lines.value.push({
    id: crypto.randomUUID(),
    productId: initialProductId && activeProducts.value.some((product) => product.id === initialProductId)
      ? initialProductId
      : fallbackProductId,
    quantity: 1,
  });
};

const removeLine = (lineId: string) => {
  if (lines.value.length <= 1) return;
  lines.value = lines.value.filter((line) => line.id !== lineId);
};

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;

    state.sourceBranchId = props.selectedBranchId ?? props.sourceBranches[0]?.id ?? "";
    state.destinationBranchId = props.destinationBranches.find((branch) => branch.id !== state.sourceBranchId)?.id ?? "";
    state.observations = "";

    lines.value = [];
    addLine(props.selectedProductId);
  },
  { immediate: true },
);

watch(
  () => state.sourceBranchId,
  () => {
    if (state.destinationBranchId === state.sourceBranchId) {
      state.destinationBranchId = availableDestinations.value[0]?.id ?? "";
    }
  },
);

const canSubmit = computed(() => {
  if (!state.sourceBranchId || !state.destinationBranchId) return false;
  if (state.sourceBranchId === state.destinationBranchId) return false;
  if (!state.observations.trim()) return false;
  if (lines.value.length < 1 || lines.value.length > 50) return false;
  if (localValidationErrors.value.length > 0) return false;
  return true;
});

const submit = () => {
  if (!canSubmit.value) return;

  emits("submit", {
    idempotencyKey: crypto.randomUUID(),
    sourceBranchId: state.sourceBranchId,
    destinationBranchId: state.destinationBranchId,
    observations: state.observations.trim(),
    internalNote: "",
    lines: draftLines.value,
  });
};
</script>

<template>
  <UModal
    :open="open"
    title="Transferir stock en lote"
    description="Crea una transferencia pendiente de 1..50 productos entre sucursales."
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4 md:space-y-5">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UFormField label="Sucursal origen" name="sourceBranchId">
            <USelect
              v-if="props.role === 'admin' || managerShowsSourceBranchSelect"
              v-model="state.sourceBranchId"
              :items="sourceBranchOptions"
              label-key="label"
              value-key="value"
              placeholder="Selecciona origen"
              :disabled="loading"
              class="w-full"
            />
            <p v-else class="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
              {{ managerSingleSourceBranch?.code ? `${managerSingleSourceBranch.name} (${managerSingleSourceBranch.code})` : (managerSingleSourceBranch?.name ?? "Sin sucursal asignada") }}
            </p>
          </UFormField>

          <UFormField label="Sucursal destino" name="destinationBranchId">
            <USelect
              v-model="state.destinationBranchId"
              :items="destinationBranchOptions"
              label-key="label"
              value-key="value"
              placeholder="Selecciona destino"
              :disabled="loading"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="rounded-2xl border border-sky-200 bg-sky-50/80 p-3 text-sm dark:border-sky-900/70 dark:bg-sky-950/20">
          <p class="font-medium text-sky-900 dark:text-sky-100">
            Consolidacion previa del lote
          </p>
          <p class="mt-1 text-sky-700 dark:text-sky-200">
            Entrada: {{ localNormalization.originalLines }} linea(s) | Normalizado: {{ localNormalization.normalizedLines }} | Productos fusionados: {{ localNormalization.mergedProducts }}
          </p>
        </div>

        <UAlert
          v-if="localWarnings.length > 0"
          color="info"
          variant="soft"
          icon="i-lucide-merge"
          :description="localWarnings.join(' ')"
        />

        <div class="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">
              Productos del lote
            </p>
            <div class="flex items-center gap-2">
              <UBadge color="neutral" variant="soft">
                {{ lines.length }} linea(s)
              </UBadge>
              <UButton color="primary" variant="soft" size="sm" :disabled="loading || lines.length >= 50" @click="addLine()">
                Agregar producto
              </UButton>
            </div>
          </div>

          <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/60">
            <table class="min-w-full text-sm">
              <thead class="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                <tr>
                  <th class="px-3 py-2">Producto</th>
                  <th class="px-3 py-2">Disponible</th>
                  <th class="px-3 py-2">Cantidad</th>
                  <th class="px-3 py-2 text-right">Accion</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in lines" :key="line.id" class="border-b border-slate-100 last:border-b-0 dark:border-slate-800/70">
                  <td class="px-3 py-2">
                    <USelect
                      v-model="line.productId"
                      :items="productOptions"
                      label-key="label"
                      value-key="value"
                      placeholder="Selecciona producto"
                      searchable
                      :disabled="loading"
                      class="w-full min-w-[18rem]"
                    />
                  </td>
                  <td class="px-3 py-2 text-slate-700 dark:text-slate-200">
                    {{ getAvailableQuantity(line.productId) }}
                  </td>
                  <td class="px-3 py-2">
                    <UInput v-model.number="line.quantity" type="number" min="1" :disabled="loading" :ui="{ base: 'min-h-10 text-sm' }" />
                  </td>
                  <td class="px-3 py-2 text-right">
                    <UButton color="error" variant="ghost" size="sm" :disabled="loading || lines.length <= 1" @click="removeLine(line.id)">
                      Quitar
                    </UButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <UAlert
          v-if="localValidationErrors.length > 0"
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          :description="localValidationErrors[0]"
        />

        <UFormField label="Observaciones" name="observations">
          <UTextarea v-model="state.observations" :rows="3" placeholder="Detalle operativo del lote" :disabled="loading" :ui="{ base: 'text-base' }" />
        </UFormField>

        <UAlert
          v-if="precheckWarnings.length > 0"
          color="info"
          variant="soft"
          icon="i-lucide-info"
          :description="precheckWarnings.join(' ')"
        />

        <div
          v-if="precheckNormalization"
          class="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm dark:border-amber-900/70 dark:bg-amber-950/20"
        >
          <p class="font-medium text-amber-900 dark:text-amber-100">
            Resultado de prevalidacion
          </p>
          <p class="mt-1 text-amber-800 dark:text-amber-200">
            Entrada: {{ precheckNormalization.originalLines }} | Normalizado: {{ precheckNormalization.normalizedLines }} | Productos fusionados: {{ precheckNormalization.mergedProducts }}
          </p>
        </div>

        <UAlert
          v-if="precheckErrors.length > 0"
          color="warning"
          variant="soft"
          icon="i-lucide-alert-triangle"
          title="Prevalidacion con errores"
          :description="`Se encontraron ${precheckErrors.length} linea(s) con error.`"
        />

        <div v-if="detailedPrecheckErrors.length > 0" class="max-h-48 space-y-2 overflow-auto rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs dark:border-amber-900/70 dark:bg-amber-950/20">
          <div v-for="error in detailedPrecheckErrors" :key="`${error.lineIndex}:${error.productId}:${error.errorCode}`" class="rounded-lg bg-white/80 p-2 dark:bg-slate-900/80">
            <p class="font-semibold text-slate-900 dark:text-slate-100">
              {{ error.lineLabel }} | {{ error.productLabel }}
            </p>
            <p class="text-slate-600 dark:text-slate-300">
              {{ error.errorMessage ?? "La linea no es valida." }}
            </p>
          </div>
        </div>

        <UiResponsiveModalActions>
          <UButton color="neutral" variant="ghost" block class="min-h-11 sm:w-auto" :disabled="loading" @click="emits('update:open', false)">
            Cancelar
          </UButton>
          <UButton type="button" color="primary" block class="min-h-11 sm:w-auto" :loading="loading" :disabled="!canSubmit" @click="submit">
            Prevalidar y crear lote
          </UButton>
        </UiResponsiveModalActions>
      </div>
    </template>
  </UModal>
</template>
