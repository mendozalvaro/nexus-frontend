<script setup lang="ts">
import type {
  InventoryAdjustmentBatchLine,
  InventoryAdjustmentBatchPayload,
  InventoryBatchNormalization,
  InventoryBatchValidationError,
  InventoryBranchOption,
  InventoryMovementFormLine,
  InventoryMovementFormState,
  InventoryProductRowView,
} from "@/utils/inventory";
import {
  buildInventoryMovementSchema,
  getInventoryLineStockInfo,
} from "@/utils/inventory";
import InventoryMovementLineCard from "@/components/inventory/forms/InventoryMovementLineCard.vue";
import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import AdminReadonlyField from "@/components/ui/forms/AdminReadonlyField.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

interface InventoryMovementLineCardApi {
  closeDropdown: () => void;
}

interface NuxtFormApi<T> {
  validate: (opts?: { nested?: boolean; silent?: boolean }) => Promise<T | false>;
  clear: (path?: string | RegExp) => void;
}

const props = defineProps<{
  open: boolean;
  title: string;
  branches: InventoryBranchOption[];
  products: InventoryProductRowView[];
  initialProductId?: string | null;
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

const movementForm = ref<NuxtFormApi<InventoryMovementFormState> | null>(null);
const movementIdempotencyKey = ref("");
const reasonPopoverOpen = ref(false);
const lineCardRefs = ref<Record<string, InventoryMovementLineCardApi | null>>({});

const state = reactive<InventoryMovementFormState>({
  branchId: "",
  mode: "add",
  reason: "",
  referenceCode: "",
  lines: [],
});

const schema = computed(() => buildInventoryMovementSchema(props.products));

const movementModeOptions = [
  { label: "Agregar stock", value: "add", icon: "i-heroicons-plus-circle" },
  { label: "Reducir stock", value: "remove", icon: "i-heroicons-minus-circle" },
  { label: "Establecer cantidad", value: "set", icon: "i-heroicons-adjustments-horizontal" },
];

const commonReasonOptions = [
  { label: "Entrada de mercancía", icon: "i-heroicons-arrow-down-tray" },
  { label: "Ajuste de inventario", icon: "i-heroicons-adjustments-horizontal" },
  { label: "Daño o pérdida", icon: "i-heroicons-exclamation-triangle" },
] as const;
const branchFieldId = "inventory-movement-branch";
const modeFieldId = "inventory-movement-mode";
const reasonFieldId = "inventory-movement-reason";

const selectedBranch = computed(() => {
  return props.branches.find((branch) => branch.id === state.branchId) ?? null;
});

const showBranchSelect = computed(() => {
  if (props.role === "admin") {
    return true;
  }

  return props.branches.length > 1;
});

function createReferenceCode() {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `INV-MOV-${seq}/${year}`;
}

function createEmptyLine(): InventoryMovementFormLine {
  return {
    id: crypto.randomUUID(),
    productId: "",
    quantity: 1,
    minStockLevel: null,
  };
}

function setLineCardRef(lineId: string, component: InventoryMovementLineCardApi | null) {
  lineCardRefs.value[lineId] = component;
}

function closeAllPickers() {
  Object.values(lineCardRefs.value).forEach((card) => card?.closeDropdown());
}

function resetForm() {
  movementIdempotencyKey.value = `INV_ADJ_${Date.now()}`;
  state.branchId = "";
  state.mode = "add";
  state.reason = "";
  state.referenceCode = "";
  state.lines = [createEmptyLine()];
  lineCardRefs.value = {};
  reasonPopoverOpen.value = false;
  movementForm.value?.clear();
}

function initializeForm() {
  resetForm();

  if (props.branches.length === 1 && props.role !== "admin") {
    const firstBranch = props.branches[0];
    if (firstBranch) {
      state.branchId = firstBranch.id;
    }
  }

  const firstLine = state.lines[0];
  if (firstLine && props.initialProductId && props.products.some((product) => product.id === props.initialProductId)) {
    firstLine.productId = props.initialProductId;
  }
}

function handleOpenChange(openValue: boolean) {
  if (!openValue) {
    closeAllPickers();
    resetForm();
  }

  emits("update:open", openValue);
}

function addLine() {
  closeAllPickers();
  state.lines.push(createEmptyLine());
  movementForm.value?.clear(/^lines(\..*)?$/);
}

function removeLine(lineId: string) {
  if (state.lines.length <= 1) {
    return;
  }

  closeAllPickers();
  state.lines = state.lines.filter((line) => line.id !== lineId);
  delete lineCardRefs.value[lineId];
  movementForm.value?.clear(/^lines(\..*)?$/);
}

function getExcludedProductIds(lineId: string) {
  return state.lines
    .filter((line) => line.id !== lineId && Boolean(line.productId))
    .map((line) => line.productId);
}

function updateProduct(lineId: string, productId: string) {
  const line = state.lines.find((item) => item.id === lineId);
  if (!line) {
    return;
  }

  line.productId = productId;

  if (line.minStockLevel === null) {
    const stockInfo = getInventoryLineStockInfo(line, state.branchId, props.products);
    line.minStockLevel = stockInfo?.minStockLevel ?? 0;
  }

  movementForm.value?.clear(/^lines(\..*)?$/);
}

function buildPayload(formData: InventoryMovementFormState): InventoryAdjustmentBatchPayload {
  const trimmedReferenceCode = formData.referenceCode.trim();

  return {
    idempotencyKey: movementIdempotencyKey.value,
    branchId: formData.branchId,
    mode: formData.mode,
    reason: formData.reason.trim(),
    referenceCode: trimmedReferenceCode || undefined,
    note: trimmedReferenceCode || undefined,
    lines: formData.lines.map(({ productId, quantity, minStockLevel }) => ({
      productId,
      quantity,
      minStockLevel: minStockLevel ?? undefined,
    })),
  };
}

async function runAction(action: "submit" | "validate") {
  closeAllPickers();

  let validatedState: InventoryMovementFormState | false | undefined;

  try {
    validatedState = await movementForm.value?.validate({ nested: true, silent: false });
  } catch {
    return;
  }

  if (!validatedState) {
    return;
  }

  if (action === "validate" && !state.referenceCode) {
    state.referenceCode = createReferenceCode();
  }

  const payload = buildPayload({
    ...validatedState,
    referenceCode: state.referenceCode,
  });

  if (action === "validate") {
    emits("validate", payload);
    return;
  }

  emits("submit", payload);
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      initializeForm();
      return;
    }

    closeAllPickers();
  },
  { immediate: true },
);

watch(() => state.branchId, () => {
  closeAllPickers();
  movementForm.value?.clear(/^lines(\..*)?$/);
});
</script>

<template>
  <UModal
    :open="props.open"
    :title="props.title"
    description="Registra un movimiento masivo de inventario por lote."
    :ui="{ content: 'max-w-3xl' }"
    @update:open="handleOpenChange"
  >
    <template #body>
      <div class="space-y-6">
        <UForm
          ref="movementForm"
          :schema="schema"
          :state="state"
          class="space-y-6"
        >
          <AdminFormSection
            title="Movimiento masivo"
            description="Define la sucursal, el tipo de movimiento y el motivo operativo del lote masivo."
            :columns="2"
          >
            <template #badge>
              <UBadge v-if="state.referenceCode" size="xs" color="blue" variant="subtle">
                Provisional: {{ state.referenceCode }}
              </UBadge>
            </template>

            <UFormField v-if="showBranchSelect" label="Sucursal" name="branchId">
              <USelectMenu
                v-model="state.branchId"
                :id="branchFieldId"
                name="branchId"
                :items="props.branches"
                value-key="id"
                label-key="name"
                placeholder="Seleccionar sucursal"
                :disabled="!props.branches.length"
                class="w-full"
                :ui="ADMIN_FIELD_UI"
              />
            </UFormField>

            <AdminReadonlyField
              v-else
              label="Sucursal"
              name="branchId-readonly"
              :value="selectedBranch?.code ? `${selectedBranch.name} (${selectedBranch.code})` : selectedBranch?.name ?? 'Sin sucursal asignada'"
            />

            <UFormField label="Tipo de movimiento" name="mode">
              <USelectMenu
                v-model="state.mode"
                :id="modeFieldId"
                name="mode"
                :items="movementModeOptions"
                value-key="value"
                label-key="label"
                placeholder="Tipo de movimiento"
                class="w-full"
                :ui="ADMIN_FIELD_UI"
              />
            </UFormField>

            <UFormField label="Motivo" name="reason" class="sm:col-span-2">
              <UTextarea
                v-model="state.reason"
                :id="reasonFieldId"
                name="reason"
                placeholder="Motivo del ajuste de inventario..."
                :rows="4"
                autoresize
                class="w-full"
                :ui="ADMIN_FIELD_UI"
                :disabled="!state.branchId"
              />

              <div class="mt-2">
                <UPopover v-model:open="reasonPopoverOpen" strategy="absolute">
                  <UButton
                    color="gray"
                    variant="link"
                    size="2xs"
                    class="ml-1"
                    trailing-icon="i-heroicons-question-mark-circle"
                  >
                    Ayuda con motivos comunes
                  </UButton>

                  <template #content>
                    <div class="w-64 p-3">
                      <h4 class="mb-2 font-medium text-slate-900 dark:text-white">
                        Ejemplos de motivos comunes
                      </h4>
                      <ul class="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                        <li
                          v-for="option in commonReasonOptions"
                          :key="option.label"
                          class="flex cursor-pointer items-start rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                          @click="state.reason = option.label; reasonPopoverOpen = false"
                        >
                          <UIcon :name="option.icon" class="mr-2 mt-0.5 h-4 w-4" />
                          {{ option.label }}
                        </li>
                      </ul>
                    </div>
                  </template>
                </UPopover>
              </div>
            </UFormField>
          </AdminFormSection>

          <AdminFormSection
            title="Lote de ajuste"
            description="Selecciona los productos y ajusta las cantidades del lote con visibilidad del stock actual."
            :columns="1"
          >
            <div class="space-y-4">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  Puedes agregar varias líneas al lote y prevalidarlas antes de confirmar.
                </p>
                <UButton size="sm" color="neutral" variant="outline" @click="addLine">
                  <UIcon name="i-heroicons-plus-circle" class="mr-2 h-4 w-4" />
                  Agregar línea
                </UButton>
              </div>

              <div
                v-if="state.lines.length === 0"
                class="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400"
              >
                <UIcon name="i-heroicons-shopping-cart" class="mx-auto mb-3 h-10 w-10 text-slate-400" />
                <p>No hay productos seleccionados.</p>
                <p class="mt-1">Haz clic en &quot;Agregar línea&quot; para comenzar.</p>
              </div>

              <div v-else class="space-y-4">
                <InventoryMovementLineCard
                  v-for="(line, idx) in state.lines"
                  :key="line.id"
                  :ref="(component) => setLineCardRef(line.id, component as InventoryMovementLineCardApi | null)"
                  :line="line"
                  :line-index="idx"
                  :mode="state.mode"
                  :branch-id="state.branchId"
                  :products="props.products"
                  :excluded-product-ids="getExcludedProductIds(line.id)"
                  :can-remove="state.lines.length > 1"
                  @remove="removeLine(line.id)"
                  @update:product-id="updateProduct(line.id, $event)"
                />
              </div>
            </div>
          </AdminFormSection>
        </UForm>

        <div
          v-if="props.precheckErrors && props.precheckErrors.length > 0"
          class="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/20"
        >
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-base font-semibold text-slate-900 dark:text-white">
              Errores detectados
            </h4>
            <span class="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
              Importante
            </span>
          </div>
          <ul class="space-y-2">
            <li
              v-for="(error, idx) in props.precheckErrors"
              :key="idx"
              class="rounded-xl border border-rose-200/90 bg-white p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
            >
              <span class="font-semibold">Línea {{ error.lineIndex + 1 }}:</span>
              {{ error.errorMessage }}
              <span
                v-if="error.currentQuantity !== null && error.nextQuantity !== null"
                class="text-slate-500 dark:text-slate-400"
              >
                ({{ error.currentQuantity }} → {{ error.nextQuantity }})
              </span>
            </li>
          </ul>
        </div>

        <div
          v-if="props.precheckWarnings && props.precheckWarnings.length > 0"
          class="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20"
        >
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-base font-semibold text-slate-900 dark:text-white">
              Advertencias
            </h4>
            <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              Atención
            </span>
          </div>
          <ul class="space-y-2">
            <li
              v-for="(warning, idx) in props.precheckWarnings"
              :key="idx"
              class="rounded-xl border border-amber-200/90 bg-white p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            >
              {{ warning }}
            </li>
          </ul>
        </div>

        <div
          v-if="props.precheckNormalization"
          class="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40"
        >
          <h4 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">
            Optimización
          </h4>
          <div class="grid gap-2 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-3">
            <p class="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-950/70">
              Líneas originales:
              <span class="font-semibold text-slate-900 dark:text-white">{{ props.precheckNormalization.originalLines }}</span>
            </p>
            <p class="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-950/70">
              Líneas consolidadas:
              <span class="font-semibold text-slate-900 dark:text-white">{{ props.precheckNormalization.normalizedLines }}</span>
            </p>
            <p class="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-950/70">
              Productos repetidos fusionados:
              <span class="font-semibold text-slate-900 dark:text-white">{{ props.precheckNormalization.mergedProducts }}</span>
            </p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <AdminFormActions>
        <UButton
          label="Cancelar"
          variant="ghost"
          color="neutral"
          class="w-full text-slate-600 dark:text-slate-400 sm:w-auto"
          @click="handleOpenChange(false)"
        />
        <UButton
          label="Prevalidar"
          color="neutral"
          variant="soft"
          class="w-full sm:w-auto"
          :disabled="props.loading"
          @click="runAction('validate')"
        />
        <UButton
          :label="state.branchId ? 'Confirmar movimiento masivo' : 'Seleccionar sucursal'"
          color="primary"
          class="w-full rounded-2xl px-6 shadow-lg shadow-primary-500/20 sm:w-auto"
          :disabled="props.loading"
          @click="runAction('submit')"
        />
      </AdminFormActions>
    </template>
  </UModal>
</template>

