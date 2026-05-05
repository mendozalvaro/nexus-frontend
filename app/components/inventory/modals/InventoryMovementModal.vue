<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { InventoryAdjustmentBatchLine } from "@/utils/inventory";

type AdjustmentMode = "set" | "add" | "remove";

interface AdjustmentProduct {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  currentQuantity: number;
  minStockLevel: number | null;
}

interface InventoryAdjustmentBatchPayload {
  idempotencyKey: string;
  branchId: string;
  mode: AdjustmentMode;
  reason: string;
  note?: string;
  lines: Array<{
    productId: string;
    quantity: number;
    minStockLevel?: number | null;
  }>;
}

interface InventoryBatchValidationError {
  lineIndex: number;
  productId?: string;
  errorCode: string;
  errorMessage: string;
  currentQuantity?: number;
  nextQuantity?: number;
}

interface InventoryBatchNormalization<T> {
  originalLines: number;
  normalizedLines: number;
  mergedProducts: number;
  data: T[];
}

type InventoryBranchOption = {
  id: string;
  name: string;
  code?: string;
};

type InventoryProductRowView = {
  id: string;
  name: string;
  sku?: string;
  categoryName?: string;
  isActive: boolean;
  stockByBranch: Array<{
    branchId: string;
    quantity: number;
    availableQuantity: number;
    minStockLevel: number | null;
  }>;
};

const props = defineProps<{
  open: boolean;
  title: string;
  branches: InventoryBranchOption[];
  products: InventoryProductRowView[];
  loading?: boolean;
  role?: "admin" | "manager";
  precheckErrors?: InventoryBatchValidationError[];
  precheckNormalization?: InventoryBatchNormalization<InventoryAdjustmentBatchLine> | null;
  precheckWarnings?: string[];
}>();

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [InventoryAdjustmentBatchPayload];
  validate: [InventoryAdjustmentBatchPayload];
}>();

const branchId = ref("");
const mode = ref<AdjustmentMode>("add");
const reason = ref("");
const note = ref("");
const productsQuery = ref("");
const showProductDropdown = ref<Record<number, boolean>>({});
const adjustments = ref<AdjustmentProduct[]>([createEmptyAdjustment()]);
const movementIdempotencyKey = ref(`INV_ADJ_${Date.now()}`);
const generatedCode = ref("");
const showReasonHelper = ref(false);
const reasonPopoverOpen = ref(false);

const selectedBranch = computed(() => {
  return props.branches.find((branch) => branch.id === branchId.value) ?? null;
});

const availableProducts = computed(() => {
  const query = productsQuery.value.trim().toLowerCase();
  if (!query) {
    return props.products.filter(p => p.isActive);
  }

  return props.products.filter((product) =>
    [product.name, product.sku ?? "", product.categoryName ?? ""].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
});

const showBranchSelect = computed(() => {
  if (props.role === "admin") return true;
  return props.branches.length > 1;
});

const isValid = computed(() => {
  return (
    !!branchId.value &&
    !!reason.value.trim() &&
    adjustments.value.length > 0 &&
    adjustments.value.every(
      (adj) => adj.productId && adj.quantity > 0 && adj.currentQuantity !== -1,
    )
  );
});

function createEmptyAdjustment(): AdjustmentProduct {
  return {
    id: Math.random().toString(36).substring(2, 9),
    productId: "",
    productName: "",
    productSku: "",
    quantity: 1,
    currentQuantity: -1,
    minStockLevel: null,
  };
}

function updateProduct(idx: number, productId: string) {
  const adjustment = adjustments.value[idx];
  if (!adjustment) return;

  const product = props.products.find((p) => p.id === productId);
  if (!product) {
    adjustment.productName = "";
    adjustment.productSku = "";
    adjustment.currentQuantity = -1;
    return;
  }

  adjustment.productId = product.id;
  adjustment.productName = product.name;
  adjustment.productSku = product.sku ?? "";

  const stockInfo = selectedBranch.value
    ? product.stockByBranch.find((s) => s.branchId === selectedBranch.value!.id)
    : null;
  adjustment.currentQuantity = stockInfo ? stockInfo.quantity : 0;

  if (adjustment.minStockLevel === null) {
    adjustment.minStockLevel = stockInfo ? stockInfo.minStockLevel : 0;
  }

  showProductDropdown.value[idx] = false;
  productsQuery.value = "";
}

function toggleProductDropdown(idx: number) {
  showProductDropdown.value[idx] = !showProductDropdown.value[idx];
  if (showProductDropdown.value[idx]) {
    productsQuery.value = "";
  }
}

function generateDocumentCode() {
  const now = new Date();
  const year = now.getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  generatedCode.value = `INV-MOV-${seq}/${year}`;
}

async function handleSubmit() {
  if (!isValid.value) {
    return;
  }

  const finalNote = generatedCode.value
    ? `${generatedCode.value}${note.value ? ` — ${note.value}` : ""}`
    : note.value || undefined;

  const payload: InventoryAdjustmentBatchPayload = {
    idempotencyKey: movementIdempotencyKey.value,
    branchId: branchId.value,
    mode: mode.value,
    reason: reason.value,
    note: finalNote,
    lines: adjustments.value.map(({ productId, quantity, minStockLevel }) => ({
      productId,
      quantity,
      minStockLevel: minStockLevel ?? undefined,
    })),
  };

  emits("submit", payload);
}

function handleOpenChange(openValue: boolean) {
  if (!openValue) {
    branchId.value = "";
    mode.value = "add";
    reason.value = "";
    note.value = "";
    productsQuery.value = "";
    generatedCode.value = "";
    showProductDropdown.value = {};
    adjustments.value = [createEmptyAdjustment()];
  }
  emits("update:open", openValue);
}

watch(selectedBranch, () => {
  adjustments.value.forEach((adj, idx) => {
    if (adj.productId) {
      updateProduct(idx, adj.productId);
    }
  });
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.branches.length === 1 && props.role !== "admin") {
      const first = props.branches[0];
      if (first) branchId.value = first.id;
    }
  },
);

function addAdjustment() {
  adjustments.value.push(createEmptyAdjustment());
}

function removeAdjustment(id: string) {
  if (adjustments.value.length <= 1) return;
  adjustments.value = adjustments.value.filter((adj) => adj.id !== id);
}

async function handleValidate() {
  if (!isValid.value) {
    return;
  }

  generateDocumentCode();

  const finalNote = generatedCode.value
    ? `${generatedCode.value}${note.value ? ` — ${note.value}` : ""}`
    : note.value || undefined;

  const payload: InventoryAdjustmentBatchPayload = {
    idempotencyKey: movementIdempotencyKey.value,
    branchId: branchId.value,
    mode: mode.value,
    reason: reason.value,
    note: finalNote,
    lines: adjustments.value.map(({ productId, quantity, minStockLevel }) => ({
      productId,
      quantity,
      minStockLevel: minStockLevel ?? undefined,
    })),
  };

  emits("validate", payload);
}

// Método para verificar advertencias de cantidad
function quantityWarning(adjustment: AdjustmentProduct): boolean {
  if (!adjustment.productId || adjustment.currentQuantity === -1) return false;
  
  if (mode.value === 'remove' && adjustment.quantity > adjustment.currentQuantity) {
    return true;
  }
  
  if (mode.value === 'set' && adjustment.quantity < (adjustment.minStockLevel || 0)) {
    return true;
  }
  
  if (mode.value === 'add' && (adjustment.currentQuantity + adjustment.quantity) < (adjustment.minStockLevel || 0)) {
    return true;
  }
  
  return false;
}
</script>

<template>
  <UModal :open="props.open" :title="props.title"
    description="Registra entradas, salidas o ajustes de inventario por producto." :ui="{ content: 'max-w-3xl' }"
    @update:open="handleOpenChange">
    <template #body>
      <div class="space-y-6">
        <form class="space-y-5">
          <div
            class="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm shadow-slate-200/20 dark:border-slate-800 dark:bg-slate-950/50 dark:shadow-black/20">
            <div class="space-y-5">
              <div class="space-y-4">
                <div class="flex flex-col gap-2">
                  <div class="flex items-center gap-2">
                    <span
                      class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Movimiento
                      de inventario</span>
                    <UBadge v-if="generatedCode" size="xs" color="blue" variant="subtle">
                      {{ generatedCode }}
                    </UBadge>
                  </div>
                  <p class="text-slate-600 dark:text-slate-300">Registra entradas, salidas o ajustes de stock con
                    motivo y nota interna.</p>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <USelectMenu v-if="showBranchSelect" v-model="branchId" :items="props.branches" value-key="id"
                      label-key="name" placeholder="Seleccionar sucursal" :disabled="!props.branches.length" />
                    <div v-else class="space-y-1">
                      <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Sucursal</label>
                      <div
                        class="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                        {{ props.branches[0]?.code ? `${props.branches[0].name} (${props.branches[0].code})` :
                          props.branches[0]?.name ?? "Sin sucursal asignada" }}
                      </div>
                    </div>
                  </div>

                  <div>
                    <USelectMenu v-model="mode" :items="[
                      { label: 'Agregar stock', value: 'add', icon: 'i-heroicons-plus-circle' },
                      { label: 'Reducir stock', value: 'remove', icon: 'i-heroicons-minus-circle' },
                      { label: 'Establecer cantidad', value: 'set', icon: 'i-heroicons-adjustments-horizontal' },
                    ]" value-key="value" label-key="label" placeholder="Tipo de movimiento" 
                    :ui="{ leadingIcon: 'mr-2 h-4 w-4' }" />
                  </div>
                </div>

                <div>
                  <UTextarea v-model="reason" label="Motivo *" placeholder="Motivo del ajuste de inventario..." 
                    :rows="4" autoresize :ui="{ base: 'text-base' }" 
                    :disabled="!branchId" />
                  <UPopover v-if="reason" v-model:open="reasonPopoverOpen" strategy="absolute">
                    <UButton color="gray" variant="link" size="2xs" class="mt-1 ml-1" :trailing-icon="!showReasonHelper ? 'i-heroicons-question-mark-circle' : 'i-heroicons-chevron-up-solid'">
                      Ayuda con motivos comunes
                    </UButton>
                    <template #content>
                      <div class="p-3 w-64">
                        <h4 class="font-medium mb-2">Ejemplos de motivos comunes:</h4>
                        <ul class="text-sm space-y-1 text-slate-600 dark:text-slate-300">
                          <li class="flex items-start cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded" 
                              @click="reason = 'Entrada de mercancía'; reasonPopoverOpen = false">
                            <UIcon name="i-heroicons-arrow-down-tray" class="mr-2 mt-0.5 h-4 w-4" />
                            Entrada de mercancía
                          </li>
                          <li class="flex items-start cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded" 
                              @click="reason = 'Ajuste de inventario'; reasonPopoverOpen = false">
                            <UIcon name="i-heroicons-adjustments-horizontal" class="mr-2 mt-0.5 h-4 w-4" />
                            Ajuste de inventario
                          </li>
                          <li class="flex items-start cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded" 
                              @click="reason = 'Daño o pérdida'; reasonPopoverOpen = false">
                            <UIcon name="i-heroicons-exclamation-triangle" class="mr-2 mt-0.5 h-4 w-4" />
                            Daño o pérdida
                          </li>
                        </ul>
                      </div>
                    </template>
                  </UPopover>
                </div>
                
                <div>
                  <UTextarea v-model="note" label="Nota interna" placeholder="Información adicional opcional..." 
                    :rows="2" autoresize :ui="{ base: 'text-base' }" />
                </div>
              </div>
            </div>
          </div>

          <!-- Sección de productos -->
          <div
            class="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm shadow-slate-200/20 dark:border-slate-800 dark:bg-slate-950/35 dark:shadow-black/10">
            <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p class="text-sm uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Productos</p>
                <h4 class="text-lg font-semibold text-slate-900 dark:text-white">Detalle de ajuste</h4>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Elige los productos y ajusta cantidades con
                  visibilidad de stock actual.</p>
              </div>
              <UButton size="sm" color="neutral" variant="outline" @click="addAdjustment">
                <UIcon name="i-heroicons-plus-circle" class="mr-2 h-4 w-4" />
                Agregar producto
              </UButton>
            </div>

            <div v-if="adjustments.length === 0"
              class="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              <UIcon name="i-heroicons-shopping-cart" class="mx-auto h-10 w-10 mb-3 text-slate-400" />
              <p>No hay productos seleccionados.</p>
              <p class="mt-1">Haz clic en "Agregar producto" para comenzar</p>
            </div>

            <div v-else class="space-y-4">
              <div v-for="(adjustment, idx) in adjustments" :key="adjustment.id"
                class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/75">
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div class="sm:col-span-5">
                    <label class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Producto *</label>
                    <div class="relative">
                      <UInput
                        :model-value="adjustment.productId ? `${adjustment.productName} (${adjustment.productSku})` : ''"
                        placeholder="Buscar producto..."
                        readonly
                        :class="adjustment.productId ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'"
                        @click="toggleProductDropdown(idx)"
                        :ui="{ base: 'min-h-11 text-base pr-10' }"
                      />
                      <div class="absolute inset-y-0 right-0 flex items-center pr-2">
                        <UIcon 
                          :name="showProductDropdown[idx] ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" 
                          class="h-5 w-5 text-slate-400" 
                        />
                      </div>

                      <div v-if="showProductDropdown[idx]"
                        class="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                        <div
                          class="sticky top-0 border-b border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                          <UInput v-model="productsQuery" placeholder="Buscar por nombre, SKU o categoría..."
                            size="sm" 
                            :ui="{ base: 'text-sm' }" 
                            @keydown.stop />
                        </div>
                        <button v-for="p in availableProducts" :key="p.id" type="button"
                          class="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                          @click="updateProduct(idx, p.id)">
                          <div class="flex justify-between">
                            <span>{{ p.sku ? `${p.name} (${p.sku})` : p.name }}</span>
                            <span class="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                              {{ p.categoryName }}
                            </span>
                          </div>
                        </button>
                        <div v-if="availableProducts.length === 0"
                          class="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                          Sin resultados
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="sm:col-span-7">
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                      <div class="md:col-span-2">
                        <UInput label="Stock actual" 
                          :model-value="adjustment.currentQuantity >= 0 ? String(adjustment.currentQuantity) : '-'" 
                          readonly disabled :ui="{ base: 'min-h-11 text-base' }" 
                          :color="adjustment.currentQuantity < (adjustment.minStockLevel || 0) ? 'red' : 'gray'" />
                      </div>
                      <UInput v-model.number="adjustment.quantity" label="Cantidad *" type="number" min="1"
                        :ui="{ base: 'min-h-11 text-base' }" 
                        :disabled="!adjustment.productId"
                        :color="quantityWarning(adjustment) ? 'orange' : 'gray'" />
                      <UInput v-model.number="adjustment.minStockLevel" label="Nuevo mínimo" type="number" min="0"
                        placeholder="Mantener actual" :ui="{ base: 'min-h-11 text-base' }" 
                        :disabled="!adjustment.productId" />
                    </div>

                    <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div v-if="quantityWarning(adjustment)" class="text-xs text-orange-600 dark:text-orange-400 flex items-center">
                        <UIcon name="i-heroicons-exclamation-triangle" class="mr-1 h-4 w-4" />
                        <span v-if="mode === 'remove' && adjustment.quantity > adjustment.currentQuantity">
                          Cantidad superior al stock disponible
                        </span>
                        <span v-else-if="mode === 'set' && adjustment.quantity < (adjustment.minStockLevel || 0)">
                          Estableciendo por debajo del nivel mínimo
                        </span>
                        <span v-else-if="mode === 'add' && (adjustment.currentQuantity + adjustment.quantity) < (adjustment.minStockLevel || 0)">
                          Resultado por debajo del nivel mínimo
                        </span>
                      </div>
                      <UButton size="xs" color="error" variant="ghost" @click="removeAdjustment(adjustment.id)">
                        <UIcon name="i-heroicons-trash" class="mr-1 h-3 w-3" />
                        Eliminar
                      </UButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        <!-- Errors section -->
        <div v-if="props.precheckErrors && props.precheckErrors.length > 0"
          class="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/20">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-base font-semibold text-slate-900 dark:text-white">Errores detectados</h4>
            <span
              class="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">Importante</span>
          </div>
          <ul class="space-y-2">
            <li v-for="(error, idx) in props.precheckErrors" :key="idx"
              class="rounded-xl border border-rose-200/90 bg-white p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
              <span class="font-semibold">Línea {{ error.lineIndex + 1 }}:</span>
              {{ error.errorMessage }}
              <span v-if="error.currentQuantity !== null && error.nextQuantity !== null"
                class="text-slate-500 dark:text-slate-400">
                ({{ error.currentQuantity }} → {{ error.nextQuantity }})
              </span>
            </li>
          </ul>
        </div>

        <!-- Warnings section -->
        <div v-if="props.precheckWarnings && props.precheckWarnings.length > 0"
          class="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-base font-semibold text-slate-900 dark:text-white">Advertencias</h4>
            <span
              class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Atención</span>
          </div>
          <ul class="space-y-2">
            <li v-for="(warning, idx) in props.precheckWarnings" :key="idx"
              class="rounded-xl border border-amber-200/90 bg-white p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {{ warning }}
            </li>
          </ul>
        </div>

        <!-- Normalization info -->
        <div v-if="props.precheckNormalization"
          class="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
          <h4 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">Optimización</h4>
          <div class="grid gap-2 sm:grid-cols-3 text-sm text-slate-700 dark:text-slate-200">
            <p class="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-950/70">Líneas originales: <span
                class="font-semibold text-slate-900 dark:text-white">{{ props.precheckNormalization.originalLines
                }}</span></p>
            <p class="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-950/70">Líneas consolidadas: <span
                class="font-semibold text-slate-900 dark:text-white">{{ props.precheckNormalization.normalizedLines
                }}</span></p>
            <p class="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-950/70">Productos repetidos fusionados: <span
                class="font-semibold text-slate-900 dark:text-white">{{ props.precheckNormalization.mergedProducts
                }}</span></p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <UButton color="neutral" variant="outline" class="w-full sm:w-auto" @click="handleOpenChange(false)">
          <UIcon name="i-heroicons-x-mark" class="mr-2 h-4 w-4" />
          Cancelar
        </UButton>
        <div class="flex flex-col gap-3 sm:flex-row sm:justify-end w-full sm:w-auto">
          <UButton color="neutral" variant="soft" class="w-full sm:w-auto" :disabled="!isValid || props.loading"
            @click="handleValidate">
            <UIcon name="i-heroicons-magnifying-glass" class="mr-2 h-4 w-4" />
            Pre-validar
          </UButton>
          <UButton color="primary" variant="solid" class="w-full sm:w-auto" :disabled="!isValid || props.loading"
            @click="handleSubmit">
            <UIcon name="i-heroicons-check-circle" class="mr-2 h-4 w-4" />
            {{ branchId ? 'Confirmar movimiento' : 'Seleccionar sucursal' }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>