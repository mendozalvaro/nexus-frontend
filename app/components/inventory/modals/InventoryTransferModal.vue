<script setup lang="ts">
import type {
  InventoryBatchNormalization,
  InventoryBatchValidationError,
  InventoryBranchOption,
  InventoryProductRowView,
  InventoryTransferBatchLine,
  InventoryTransferBatchPayload,
  InventoryTransferFormLine,
  InventoryTransferFormState,
} from "@/utils/inventory";
import { buildInventoryTransferSchema } from "@/utils/inventory";
import InventoryTransferLineCard from "@/components/inventory/forms/InventoryTransferLineCard.vue";
import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import AdminReadonlyField from "@/components/ui/forms/AdminReadonlyField.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

interface TransferLineCardApi {
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
  allBranches?: InventoryBranchOption[];
  products: InventoryProductRowView[];
  initialProductId?: string | null;
  loading?: boolean;
  role?: "admin" | "manager";
  precheckErrors?: InventoryBatchValidationError[];
  precheckNormalization?: InventoryBatchNormalization<InventoryTransferBatchLine> | null;
  precheckWarnings?: string[];
}>();

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [InventoryTransferBatchPayload];
  validate: [InventoryTransferBatchPayload];
}>();

const transferForm = ref<NuxtFormApi<InventoryTransferFormState> | null>(null);
const transferIdempotencyKey = ref("");
const lineCardRefs = ref<Record<string, TransferLineCardApi | null>>({});

const state = reactive<InventoryTransferFormState>({
  sourceBranchId: "",
  destinationBranchId: "",
  observations: "",
  generatedCode: "",
  lines: [],
});

const schema = computed(() => buildInventoryTransferSchema(props.products));

const destinationBranchOptions = computed(() => {
  return props.allBranches ?? props.branches;
});

const filteredDestinationOptions = computed(() => {
  return destinationBranchOptions.value.filter((branch) => branch.id !== state.sourceBranchId);
});

const selectedSourceBranch = computed(() => {
  return props.branches.find((branch) => branch.id === state.sourceBranchId) ?? null;
});

const showSourceSelect = computed(() => {
  if (props.role === "admin") {
    return true;
  }

  return props.branches.length > 1;
});

const modalLayout = "two-column";
const modalContentClass = modalLayout === "two-column" ? "max-w-4xl" : "max-w-xl";
const sourceBranchFieldId = "inventory-transfer-source-branch";
const destinationBranchFieldId = "inventory-transfer-destination-branch";
const observationsFieldId = "inventory-transfer-observations";

function createTransferCode() {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `INV-TRA-${seq}/${year}`;
}

function createEmptyLine(): InventoryTransferFormLine {
  return {
    id: crypto.randomUUID(),
    productId: "",
    quantity: 1,
  };
}

function setLineCardRef(lineId: string, component: TransferLineCardApi | null) {
  lineCardRefs.value[lineId] = component;
}

function closeAllPickers() {
  Object.values(lineCardRefs.value).forEach((card) => card?.closeDropdown());
}

function resetForm() {
  transferIdempotencyKey.value = `INV_TRF_${Date.now()}`;
  state.sourceBranchId = "";
  state.destinationBranchId = "";
  state.observations = "";
  state.generatedCode = "";
  state.lines = [createEmptyLine()];
  lineCardRefs.value = {};
  transferForm.value?.clear();
}

function initializeForm() {
  resetForm();

  if (props.branches.length === 1 && props.role !== "admin") {
    const firstBranch = props.branches[0];
    if (firstBranch) {
      state.sourceBranchId = firstBranch.id;
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
  transferForm.value?.clear(/^lines(\..*)?$/);
}

function removeLine(lineId: string) {
  if (state.lines.length <= 1) {
    return;
  }

  closeAllPickers();
  state.lines = state.lines.filter((line) => line.id !== lineId);
  delete lineCardRefs.value[lineId];
  transferForm.value?.clear(/^lines(\..*)?$/);
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
  transferForm.value?.clear(/^lines(\..*)?$/);
}

function buildPayload(formData: InventoryTransferFormState): InventoryTransferBatchPayload {
  return {
    idempotencyKey: `${transferIdempotencyKey.value}_${formData.sourceBranchId.slice(0, 8)}_${formData.destinationBranchId.slice(0, 8)}`,
    sourceBranchId: formData.sourceBranchId,
    destinationBranchId: formData.destinationBranchId,
    observations: formData.observations.trim(),
    referenceCode: formData.generatedCode || undefined,
    lines: formData.lines.map(({ productId, quantity }) => ({
      productId,
      quantity,
    })),
  };
}

async function runAction(action: "submit" | "validate") {
  closeAllPickers();

  let validatedState: InventoryTransferFormState | false | undefined;

  try {
    validatedState = await transferForm.value?.validate({ nested: true, silent: false });
  } catch {
    return;
  }

  if (!validatedState) {
    return;
  }

  if (action === "validate" && !state.generatedCode) {
    state.generatedCode = createTransferCode();
  }

  const payload = buildPayload({
    ...validatedState,
    generatedCode: state.generatedCode,
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

watch(() => state.sourceBranchId, () => {
  closeAllPickers();

  if (state.destinationBranchId === state.sourceBranchId) {
    state.destinationBranchId = "";
  }

  transferForm.value?.clear(/^lines(\..*)?$/);
});
</script>

<template>
  <UModal
    :open="props.open"
    :title="props.title"
    description="Registra una transferencia masiva de productos entre sucursales."
    :ui="{ content: modalContentClass }"
    @update:open="handleOpenChange"
  >
    <template #body>
      <div class="space-y-6">
        <UForm
          ref="transferForm"
          :schema="schema"
          :state="state"
          class="space-y-6"
        >
          <AdminFormSection
            title="Transferencia masiva"
            description="Define la sucursal de origen, el destino y la justificación operativa del lote."
            :columns="2"
          >
            <template #badge>
              <UBadge v-if="state.generatedCode" size="xs" color="blue" variant="subtle">
                Provisional: {{ state.generatedCode }}
              </UBadge>
            </template>

            <UFormField v-if="showSourceSelect" label="Sucursal origen" name="sourceBranchId">
              <USelectMenu
                v-model="state.sourceBranchId"
                :id="sourceBranchFieldId"
                name="sourceBranchId"
                :items="props.branches"
                value-key="id"
                label-key="name"
                placeholder="Seleccionar sucursal origen"
                class="w-full"
                :disabled="!props.branches.length"
                :ui="ADMIN_FIELD_UI"
              />
            </UFormField>

            <AdminReadonlyField
              v-else
              label="Sucursal origen"
              name="sourceBranchId-readonly"
              :value="selectedSourceBranch?.code ? `${selectedSourceBranch.name} (${selectedSourceBranch.code})` : selectedSourceBranch?.name ?? 'Sin sucursal asignada'"
            />

            <UFormField label="Sucursal destino" name="destinationBranchId">
              <USelectMenu
                v-model="state.destinationBranchId"
                :id="destinationBranchFieldId"
                name="destinationBranchId"
                :items="filteredDestinationOptions"
                value-key="id"
                label-key="name"
                placeholder="Seleccionar sucursal destino"
                class="w-full"
                :disabled="!filteredDestinationOptions.length"
                :ui="ADMIN_FIELD_UI"
              />
            </UFormField>

            <UFormField label="Observaciones" name="observations" class="sm:col-span-2">
              <UTextarea
                v-model="state.observations"
                :id="observationsFieldId"
                name="observations"
                placeholder="Describe el motivo de la transferencia y cualquier detalle relevante."
                :rows="3"
                autoresize
                class="w-full"
                :ui="ADMIN_FIELD_UI"
              />
              <p v-if="state.generatedCode" class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Código provisional generado:
                <span class="font-mono font-medium text-slate-700 dark:text-slate-200">{{ state.generatedCode }}</span>
              </p>
            </UFormField>
          </AdminFormSection>

          <AdminFormSection
            title="Lote de productos"
            description="Selecciona los productos y cantidades del lote masivo antes de validar."
            :columns="1"
          >
            <div class="space-y-4">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  El sistema bloqueará cantidades imposibles y productos duplicados antes de enviar.
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
                <UIcon name="i-heroicons-arrows-right-left" class="mx-auto mb-3 h-10 w-10 text-slate-400" />
                <p>No hay productos seleccionados para el lote.</p>
                <p class="mt-1">Haz clic en &quot;Agregar línea&quot; para comenzar.</p>
              </div>

              <div v-else class="space-y-4">
                <InventoryTransferLineCard
                  v-for="(line, idx) in state.lines"
                  :key="line.id"
                  :ref="(component) => setLineCardRef(line.id, component as TransferLineCardApi | null)"
                  :line="line"
                  :line-index="idx"
                  :source-branch-id="state.sourceBranchId"
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
            Consolidación
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
          :label="state.sourceBranchId && state.destinationBranchId ? 'Crear transferencia masiva' : 'Seleccionar sucursales'"
          color="primary"
          class="w-full rounded-2xl px-6 shadow-lg shadow-primary-500/20 sm:w-auto"
          :disabled="props.loading"
          @click="runAction('submit')"
        />
      </AdminFormActions>
    </template>
  </UModal>
</template>
