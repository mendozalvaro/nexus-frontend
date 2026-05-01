<script setup lang="ts">
import { normalizeInventoryAdjustmentBatchLines } from "@/composables/useInventory";

import type {
  InventoryAdjustmentBatchLine,
  InventoryAdjustmentBatchPayload,
  InventoryBatchNormalization,
  InventoryBatchValidationError,
  InventoryBranchOption,
  InventoryProductRowView,
} from "@/composables/useInventory";

type MovementKind = "entry" | "exit" | "adjustment";
type InventoryActorRole = "admin" | "manager";

interface MovementLineState {
  id: string;
  productId: string;
  quantity: number;
  minStockLevel: number | null;
}

interface MovementFormState {
  kind: MovementKind;
  branchId: string;
  reason: string;
}

const props = withDefaults(defineProps<{
  open: boolean;
  loading?: boolean;
  branches: InventoryBranchOption[];
  products: InventoryProductRowView[];
  role: InventoryActorRole;
  selectedProductId?: string | null;
  selectedBranchId?: string | null;
  precheckErrors?: InventoryBatchValidationError[];
  precheckNormalization?: InventoryBatchNormalization<InventoryAdjustmentBatchLine> | null;
  precheckWarnings?: string[];
}>(), {
  loading: false,
  selectedProductId: null,
  selectedBranchId: null,
  precheckErrors: () => [],
  precheckNormalization: null,
  precheckWarnings: () => [],
});

const emits = defineEmits<{
  "update:open": [boolean];
  validate: [InventoryAdjustmentBatchPayload];
  submit: [InventoryAdjustmentBatchPayload];
}>();

const state = reactive<MovementFormState>({
  kind: "entry",
  branchId: "",
  reason: "",
});

const lines = ref<MovementLineState[]>([]);
const validationReady = ref(false);
const movementIdempotencyKey = ref(crypto.randomUUID());

const movementKindOptions = [
  { label: "Ingreso", value: "entry" },
  { label: "Salida", value: "exit" },
  { label: "Ajuste", value: "adjustment" },
];

const movementMode = computed<InventoryAdjustmentBatchPayload["mode"]>(() => {
  if (state.kind === "entry") return "add";
  if (state.kind === "exit") return "remove";
  return "set";
});

const activeProducts = computed(() => props.products.filter((product) => product.isActive));

const productOptions = computed(() =>
  activeProducts.value.map((product) => ({
    label: product.sku ? `${product.name} (${product.sku})` : product.name,
    value: product.id,
  })));

const branchOptions = computed(() =>
  props.branches.map((branch) => ({
    label: branch.code ? `${branch.name} (${branch.code})` : branch.name,
    value: branch.id,
  })));

const managerShowsBranchSelect = computed(() => props.role === "manager" && props.branches.length > 1);
const managerSingleBranch = computed(() => (props.role === "manager" ? props.branches[0] ?? null : null));
const mustShowBranchSelect = computed(() => props.role === "admin" || managerShowsBranchSelect.value);

const productsMap = computed(() => new Map(props.products.map((product) => [product.id, product])));

const getLineStock = (productId: string) => {
  if (!productId || !state.branchId) {
    return { quantity: 0, available: 0 };
  }

  const product = productsMap.value.get(productId);
  if (!product) {
    return { quantity: 0, available: 0 };
  }

  const stock = product.stockByBranch.find((item) => item.branchId === state.branchId);
  return {
    quantity: stock?.quantity ?? 0,
    available: stock?.availableQuantity ?? 0,
  };
};

const draftLines = computed<InventoryAdjustmentBatchLine[]>(() =>
  lines.value.map((line) => ({
    productId: line.productId,
    quantity: Number(line.quantity) || 0,
    minStockLevel: state.kind === "adjustment" ? (line.minStockLevel ?? null) : null,
  })));

const localNormalization = computed(() =>
  normalizeInventoryAdjustmentBatchLines(movementMode.value, draftLines.value));

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

const addLine = (initialProductId?: string | null) => {
  const fallbackProductId = activeProducts.value[0]?.id ?? "";
  lines.value.push({
    id: crypto.randomUUID(),
    productId: initialProductId && activeProducts.value.some((product) => product.id === initialProductId)
      ? initialProductId
      : fallbackProductId,
    quantity: 1,
    minStockLevel: null,
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

    state.kind = "entry";
    state.branchId = props.selectedBranchId
      ?? managerSingleBranch.value?.id
      ?? props.branches[0]?.id
      ?? "";
    state.reason = "";
    lines.value = [];
    validationReady.value = false;
    movementIdempotencyKey.value = crypto.randomUUID();
    addLine(props.selectedProductId);
  },
  { immediate: true },
);

watch(
  () => props.branches,
  () => {
    if (props.role === "manager" && props.branches.length <= 1) {
      state.branchId = managerSingleBranch.value?.id ?? "";
    }
  },
  { deep: true },
);

const canSubmit = computed(() => {
  if (!state.reason.trim()) return false;
  if (!state.branchId) return false;
  if (lines.value.length < 1 || lines.value.length > 50) return false;

  for (const line of lines.value) {
    if (!line.productId) return false;
    if (!Number.isInteger(Number(line.quantity)) || Number(line.quantity) <= 0) return false;
  }

  return true;
});

const buildPayload = (): InventoryAdjustmentBatchPayload => ({
  idempotencyKey: movementIdempotencyKey.value,
  branchId: state.branchId,
  mode: movementMode.value,
  reason: state.reason.trim(),
  note: "",
  lines: draftLines.value,
});

watch(
  [() => state.kind, () => state.branchId, () => state.reason, lines],
  () => {
    validationReady.value = false;
    movementIdempotencyKey.value = crypto.randomUUID();
  },
  { deep: true },
);

watch(
  [() => props.loading, () => props.precheckErrors, () => props.precheckNormalization],
  () => {
    if (props.loading) return;
    if ((props.precheckErrors.length ?? 0) > 0) {
      validationReady.value = false;
      return;
    }

    if (props.precheckNormalization) {
      validationReady.value = true;
    }
  },
  { deep: true },
);

const submit = () => {
  if (!canSubmit.value) return;

  if (!validationReady.value) {
    emits("validate", buildPayload());
    return;
  }

  emits("submit", buildPayload());
};
</script>

<template>
  <UModal
    :open="open"
    title="Registrar movimiento masivo"
    description="Aplica ingresos, salidas o ajustes en lote (1..50 lineas) para una sucursal."
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4 md:space-y-5">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UFormField label="Tipo de operacion" name="kind">
            <USelect
              v-model="state.kind"
              :items="movementKindOptions"
              label-key="label"
              value-key="value"
              :disabled="loading"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Sucursal" name="branchId">
            <USelect
              v-if="mustShowBranchSelect"
              v-model="state.branchId"
              :items="branchOptions"
              label-key="label"
              value-key="value"
              placeholder="Selecciona una sucursal"
              :disabled="loading"
              class="w-full"
            />
            <div v-else class="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
              {{ managerSingleBranch?.name ?? "Sin sucursal asignada" }}
            </div>
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
                  <th class="px-3 py-2">Stock actual</th>
                  <th class="px-3 py-2">Cantidad</th>
                  <th v-if="state.kind === 'adjustment'" class="px-3 py-2">Min stock</th>
                  <th class="px-3 py-2 text-right">Accion</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in lines" :key="line.id" class="border-b border-slate-100 last:border-b-0 dark:border-slate-800/70">
                  <td class="px-3 py-2 align-top">
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
                  <td class="px-3 py-2 align-middle text-slate-700 dark:text-slate-200">
                    {{ getLineStock(line.productId).quantity }} (disp. {{ getLineStock(line.productId).available }})
                  </td>
                  <td class="px-3 py-2 align-top">
                    <UInput v-model.number="line.quantity" type="number" min="1" :disabled="loading" :ui="{ base: 'min-h-10 text-sm' }" />
                  </td>
                  <td v-if="state.kind === 'adjustment'" class="px-3 py-2 align-top">
                    <UInput v-model.number="line.minStockLevel" type="number" min="0" :disabled="loading" :ui="{ base: 'min-h-10 text-sm' }" />
                  </td>
                  <td class="px-3 py-2 align-top text-right">
                    <UButton color="error" variant="ghost" size="sm" :disabled="loading || lines.length <= 1" @click="removeLine(line.id)">
                      Quitar
                    </UButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <UFormField label="Observaciones" name="reason">
          <UTextarea v-model="state.reason" :rows="3" placeholder="Detalle operativo del lote" :disabled="loading" :ui="{ base: 'text-base' }" />
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
            {{ validationReady ? "Registrar lote" : "Validar lote" }}
          </UButton>
        </UiResponsiveModalActions>
      </div>
    </template>
  </UModal>
</template>
