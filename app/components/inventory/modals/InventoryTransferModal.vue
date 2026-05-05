<script setup lang="ts">
import { ref, computed, watch } from "vue";

interface TransferProduct {
  id: string;
  productId: string;
  quantity: number;
  currentQuantity: number;
  productName: string;
  productSku: string;
}

type InventoryBranchOption = {
  id: string;
  name: string;
  code?: string;
};

type InventoryProductRowView = {
  id: string;
  name: string;
  sku?: string | null;
  categoryName?: string | null;
  isActive: boolean;
  stockByBranch: Array<{
    branchId: string;
    quantity: number;
    availableQuantity: number;
    minStockLevel: number | null;
  }>;
};

interface InventoryTransferBatchLine {
  productId: string;
  quantity: number;
}

interface InventoryTransferBatchPayload {
  idempotencyKey: string;
  sourceBranchId: string;
  destinationBranchId: string;
  observations: string;
  internalNote?: string;
  lines: InventoryTransferBatchLine[];
}

const props = defineProps<{
  open: boolean;
  title: string;
  branches: InventoryBranchOption[];
  allBranches?: InventoryBranchOption[];
  products: InventoryProductRowView[];
  loading?: boolean;
  role?: "admin" | "manager";
  precheckErrors?: import("@/utils/inventory").InventoryBatchValidationError[];
  precheckNormalization?: import("@/utils/inventory").InventoryBatchNormalization<InventoryTransferBatchLine> | null;
  precheckWarnings?: string[];
}>();

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [InventoryTransferBatchPayload];
  validate: [InventoryTransferBatchPayload];
}>();

const sourceBranchId = ref("");
const destinationBranchId = ref("");
const observations = ref("");
const internalNote = ref("");
const productsQuery = ref("");
const showProductDropdown = ref<Record<number, boolean>>({});
const transfers = ref<TransferProduct[]>([createEmptyTransfer()]);
const generatedCode = ref("");

const availableProducts = computed(() => {
  const query = productsQuery.value.trim().toLowerCase();
  if (!query) {
    return props.products;
  }

  return props.products.filter((product) =>
    [product.name, product.sku ?? "", product.categoryName ?? ""].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
});

const destinationBranchOptions = computed(() => {
  if (props.role === "admin") {
    return props.allBranches ?? props.branches;
  }
  return props.allBranches ?? props.branches;
});

const filteredDestinationOptions = computed(() => {
  return destinationBranchOptions.value.filter(b => b.id !== sourceBranchId.value);
});

const showSourceSelect = computed(() => {
  if (props.role === "admin") return true;
  return props.branches.length > 1;
});

const isValid = computed(() => {
  return (
    !!sourceBranchId.value &&
    !!destinationBranchId.value &&
    sourceBranchId.value !== destinationBranchId.value &&
    !!observations.value.trim() &&
    transfers.value.length > 0 &&
    transfers.value.every(
      (tr) => tr.productId && tr.quantity > 0 && tr.currentQuantity !== -1
    )
  );
});

function createEmptyTransfer(): TransferProduct {
  return {
    id: crypto.randomUUID(),
    productId: "",
    productName: "",
    productSku: "",
    quantity: 1,
    currentQuantity: -1,
  };
}

function addTransfer() {
  transfers.value.push(createEmptyTransfer());
}

function removeTransfer(id: string) {
  if (transfers.value.length <= 1) return;
  transfers.value = transfers.value.filter((tr) => tr.id !== id);
}

function updateProduct(idx: number, productId: string) {
  const transfer = transfers.value[idx];
  if (!transfer) return;

  const product = props.products.find((p) => p.id === productId);
  if (!product) {
    transfer.productName = "";
    transfer.productSku = "";
    transfer.currentQuantity = -1;
    return;
  }

  transfer.productId = product.id;
  transfer.productName = product.name;
  transfer.productSku = product.sku ?? "";
  
  const stockInfo = product.stockByBranch.find((s) => s.branchId === sourceBranchId.value);
  transfer.currentQuantity = stockInfo ? stockInfo.availableQuantity : 0;

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
  generatedCode.value = `INV-TRA-${seq}/${year}`;
}

async function handleSubmit() {
  if (!isValid.value) {
    return;
  }

  const finalNote = generatedCode.value
    ? `${generatedCode.value}${internalNote.value ? ` — ${internalNote.value}` : ""}`
    : internalNote.value || undefined;

  const payload: InventoryTransferBatchPayload = {
    idempotencyKey: `INV_TRF_${new Date().getTime()}_${sourceBranchId.value.substring(0, 8)}_${destinationBranchId.value.substring(0, 8)}`,
    sourceBranchId: sourceBranchId.value,
    destinationBranchId: destinationBranchId.value,
    observations: observations.value,
    internalNote: finalNote,
    lines: transfers.value.map(({ productId, quantity }) => ({
      productId,
      quantity,
    })),
  };

  emits("submit", payload);
}

async function handleValidate() {
  if (!isValid.value) {
    return;
  }

  generateDocumentCode();

  const finalNote = generatedCode.value
    ? `${generatedCode.value}${internalNote.value ? ` — ${internalNote.value}` : ""}`
    : internalNote.value || undefined;

  const payload: InventoryTransferBatchPayload = {
    idempotencyKey: `INV_TRF_${new Date().getTime()}_${sourceBranchId.value.substring(0, 8)}_${destinationBranchId.value.substring(0, 8)}`,
    sourceBranchId: sourceBranchId.value,
    destinationBranchId: destinationBranchId.value,
    observations: observations.value,
    internalNote: finalNote,
    lines: transfers.value.map(({ productId, quantity }) => ({
      productId,
      quantity,
    })),
  };

  emits("validate", payload);
}

function handleOpenChange(openValue: boolean) {
  if (!openValue) {
    sourceBranchId.value = "";
    destinationBranchId.value = "";
    observations.value = "";
    internalNote.value = "";
    generatedCode.value = "";
    productsQuery.value = "";
    showProductDropdown.value = {};
    transfers.value = [createEmptyTransfer()];
  }
  emits("update:open", openValue);
}

watch(sourceBranchId, () => {
  if (destinationBranchId.value === sourceBranchId.value) {
    destinationBranchId.value = "";
  }
  transfers.value.forEach((tr, idx) => {
    if (tr.productId) {
      updateProduct(idx, tr.productId);
    }
  });
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.branches.length === 1 && props.role !== "admin") {
      const first = props.branches[0];
      if (first) sourceBranchId.value = first.id;
    }
  },
);
</script>

<template>
  <UModal
    :open="props.open"
    :title="props.title"
    description="Transfiere productos entre sucursales."
    :ui="{ content: 'max-w-3xl' }"
    @update:open="handleOpenChange"
  >
    <template #body>
      <div class="space-y-6">
        <form class="space-y-5">
          <div class="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm shadow-slate-200/20 dark:border-slate-800 dark:bg-slate-950/50 dark:shadow-black/20">
            <div class="space-y-5">
              <div class="grid grid-cols-1 gap-4">
                <div>
                  <div class="flex flex-col gap-2">
                    <span class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Transferencia de inventario</span>
                    <p class="text-slate-600 dark:text-slate-300">Envía stock entre sucursales con observaciones y nota interna.</p>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="sm:col-span-2">
                  <UInput
                    v-model="internalNote"
                    label="Nota interna"
                    :placeholder="generatedCode || 'Se genera después de pre-validar...'"
                    :disabled="!!generatedCode"
                    :ui="{ base: 'min-h-11 text-base' }"
                  />
                  <p v-if="generatedCode" class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Código generado: <span class="font-mono font-medium">{{ generatedCode }}</span>
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div v-if="showSourceSelect">
                    <USelectMenu
                      v-model="sourceBranchId"
                      :items="props.branches"
                      value-key="id"
                      label-key="name"
                      placeholder="Sucursal origen"
                    />
                  </div>
                  <div v-else class="space-y-1">
                    <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Sucursal de origen</label>
                    <div class="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                      {{ props.branches[0]?.code ? `${props.branches[0].name} (${props.branches[0].code})` : props.branches[0]?.name ?? "Sin sucursal asignada" }}
                    </div>
                  </div>
                </div>
                <div>
                  <USelectMenu
                    v-model="destinationBranchId"
                    :items="filteredDestinationOptions"
                    value-key="id"
                    label-key="name"
                    placeholder="Sucursal destino"
                  />
                </div>
              </div>

              <div>
                <UTextarea
                  v-model="observations"
                  label="Observaciones"
                  placeholder="Breve descripción de la transferencia..."
                  :rows="2"
                  autoresize
                  :ui="{ base: 'text-base' }"
                />
              </div>
            </div>
          </div>

          <!-- Fila 4: Tabla de productos -->
          <div class="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm shadow-slate-200/20 dark:border-slate-800 dark:bg-slate-950/35 dark:shadow-black/10">
            <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p class="text-sm uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Productos a transferir</p>
                <h4 class="text-lg font-semibold text-slate-900 dark:text-white">Detalle de la transferencia</h4>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Selecciona productos y cantidades desde la sucursal origen.</p>
              </div>
              <UButton size="sm" color="neutral" variant="ghost" @click="addTransfer">
                Agregar producto
              </UButton>
            </div>

            <div v-if="transfers.length === 0" class="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              No hay productos seleccionados.
            </div>

            <div v-else class="space-y-4">
              <div
                v-for="(transfer, idx) in transfers"
                :key="idx"
                class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/75"
              >
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div class="sm:col-span-5">
                    <label class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Producto</label>
                    <div class="relative">
                      <button
                        type="button"
                        class="w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
                        @click="toggleProductDropdown(idx)"
                      >
                        {{ transfer.productId ? `${transfer.productName} (${transfer.productSku})` : "Buscar producto..." }}
                      </button>

                      <div v-if="showProductDropdown[idx]" class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        <div class="sticky top-0 border-b border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                          <input
                            v-model="productsQuery"
                            type="text"
                            placeholder="Buscar por nombre, SKU o categoría..."
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <button
                          v-for="p in availableProducts"
                          :key="p.id"
                          type="button"
                          class="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                          @click="updateProduct(idx, p.id)"
                        >
                          {{ p.sku ? `${p.name} (${p.sku})` : p.name }}
                        </button>
                        <div v-if="availableProducts.length === 0" class="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                          Sin resultados
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="sm:col-span-7">
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                      <div class="md:col-span-2">
                        <UInput
                          label="Producto seleccionado"
                          :placeholder="transfer.productId ? `${transfer.productName} (${transfer.productSku})` : 'Ninguno'"
                          readonly
                          disabled
                          :ui="{ base: 'min-h-11 text-base' }"
                        />
                      </div>
                      <UInput
                        v-model.number="transfer.quantity"
                        label="Cantidad"
                        type="number"
                        min="1"
                        :ui="{ base: 'min-h-11 text-base' }"
                      />
                    </div>

                    <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div v-if="transfer.currentQuantity !== -1" class="text-xs text-slate-500 dark:text-slate-400">
                        Disponible en origen: <span class="font-medium text-slate-900 dark:text-white">{{ transfer.currentQuantity }}</span>
                      </div>
                      <UButton
                        size="xs"
                        color="error"
                        variant="ghost"
                        @click="removeTransfer(transfer.id)"
                      >
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
        <div v-if="props.precheckErrors && props.precheckErrors.length > 0" class="rounded-3xl border border-rose-200 bg-rose-50/80 p-4 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/20">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-base font-semibold text-slate-900 dark:text-white">Errores detectados</h4>
            <span class="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">Importante</span>
          </div>
          <ul class="space-y-2">
            <li
              v-for="(error, idx) in props.precheckErrors"
              :key="idx"
              class="rounded-2xl border border-rose-200/90 bg-white p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
            >
              <span class="font-semibold">Línea {{ error.lineIndex + 1 }}:</span>
              {{ error.errorMessage }}
              <span v-if="error.currentQuantity !== null && error.nextQuantity !== null" class="text-slate-500 dark:text-slate-400">
                ({{ error.currentQuantity }} → {{ error.nextQuantity }})
              </span>
            </li>
          </ul>
        </div>

        <!-- Warnings section -->
        <div v-if="props.precheckWarnings && props.precheckWarnings.length > 0" class="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-base font-semibold text-slate-900 dark:text-white">Advertencias</h4>
            <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Atención</span>
          </div>
          <ul class="space-y-2">
            <li
              v-for="(warning, idx) in props.precheckWarnings"
              :key="idx"
              class="rounded-2xl border border-amber-200/90 bg-white p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            >
              {{ warning }}
            </li>
          </ul>
        </div>

        <!-- Normalization info -->
        <div v-if="props.precheckNormalization" class="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
          <h4 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">Consolidación</h4>
          <div class="grid gap-2 sm:grid-cols-3 text-sm text-slate-700 dark:text-slate-200">
            <p class="rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-950/70">Líneas originales: <span class="font-semibold text-slate-900 dark:text-white">{{ props.precheckNormalization.originalLines }}</span></p>
            <p class="rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-950/70">Líneas consolidadas: <span class="font-semibold text-slate-900 dark:text-white">{{ props.precheckNormalization.normalizedLines }}</span></p>
            <p class="rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-950/70">Productos repetidos fusionados: <span class="font-semibold text-slate-900 dark:text-white">{{ props.precheckNormalization.mergedProducts }}</span></p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <UButton
          color="neutral"
          variant="outline"
          class="w-full sm:w-auto"
          @click="handleOpenChange(false)"
        >
          Cancelar
        </UButton>
        <div class="flex flex-col gap-3 sm:flex-row">
          <UButton
            color="neutral"
            variant="solid"
            class="w-full sm:w-auto"
            :disabled="!isValid || props.loading"
            @click="handleValidate"
          >
            Pre-validar
          </UButton>
          <UButton
            color="primary"
            variant="solid"
            class="w-full sm:w-auto"
            :disabled="!isValid || props.loading"
            @click="handleSubmit"
          >
            Crear transferencia
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
