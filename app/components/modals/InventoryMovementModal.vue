<script setup lang="ts">
import { z } from "zod";

import type {
  InventoryAdjustmentPayload,
  InventoryBranchOption,
  InventoryProductRowView,
  InventoryTransferPayload,
} from "@/composables/useInventory";

type MovementKind = "entry" | "exit" | "adjustment" | "transfer";

interface MovementFormState {
  kind: MovementKind;
  branchId: string;
  sourceBranchId: string;
  destinationBranchId: string;
  productId: string;
  quantity: number;
  minStockLevel: number | null;
  reason: string;
  note: string;
}

const props = withDefaults(defineProps<{
  open: boolean;
  loading?: boolean;
  branches: InventoryBranchOption[];
  products: InventoryProductRowView[];
  transferEnabled: boolean;
  selectedProductId?: string | null;
  selectedBranchId?: string | null;
}>(), {
  loading: false,
  selectedProductId: null,
  selectedBranchId: null,
});

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [{
    kind: MovementKind;
    payload: InventoryAdjustmentPayload | InventoryTransferPayload;
  }];
}>();

const state = reactive<MovementFormState>({
  kind: "entry",
  branchId: "",
  sourceBranchId: "",
  destinationBranchId: "",
  productId: "",
  quantity: 1,
  minStockLevel: null,
  reason: "",
  note: "",
});

const selectedProduct = computed(() => props.products.find((product) => product.id === state.productId) ?? null);
const selectedBranchStock = computed(() => {
  const branchId = state.kind === "transfer" ? state.sourceBranchId : state.branchId;
  return selectedProduct.value?.stockByBranch.find((item) => item.branchId === branchId) ?? null;
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    state.kind = props.transferEnabled ? "entry" : "entry";
    state.branchId = props.selectedBranchId ?? props.branches[0]?.id ?? "";
    state.sourceBranchId = props.selectedBranchId ?? props.branches[0]?.id ?? "";
    state.destinationBranchId = props.branches.find((branch) => branch.id !== state.sourceBranchId)?.id ?? props.branches[0]?.id ?? "";
    state.productId = props.selectedProductId ?? props.products[0]?.id ?? "";
    state.quantity = 1;
    state.reason = "";
    state.note = "";
    state.minStockLevel = selectedBranchStock.value?.minStockLevel ?? 5;
  },
  { immediate: true },
);

watch(
  [() => state.productId, () => state.branchId, () => state.sourceBranchId, () => state.kind],
  () => {
    state.minStockLevel = selectedBranchStock.value?.minStockLevel ?? 5;
  },
);

const branchLabel = computed(() => {
  const branchId = state.kind === "transfer" ? state.sourceBranchId : state.branchId;
  return props.branches.find((branch) => branch.id === branchId)?.name ?? "Sucursal";
});

const schema = computed(() => z.object({
  kind: z.enum(["entry", "exit", "adjustment", "transfer"]),
  branchId: z.string().optional(),
  sourceBranchId: z.string().optional(),
  destinationBranchId: z.string().optional(),
  productId: z.string().uuid("Selecciona un producto valido."),
  quantity: z.coerce.number().int("La cantidad debe ser entera.").positive("La cantidad debe ser mayor a cero."),
  minStockLevel: z.coerce.number().int("El minimo debe ser entero.").min(0, "El minimo no puede ser negativo.").nullable(),
  reason: z.string().trim().min(3, "Debes indicar el motivo del movimiento."),
  note: z.string().trim().max(240, "La nota no puede superar 240 caracteres."),
}).superRefine((_value, context) => {
  if (state.kind !== "transfer" && !state.branchId) {
    context.addIssue({ code: "custom", path: ["branchId"], message: "Selecciona una sucursal." });
  }

  if (state.kind === "transfer") {
    if (!state.sourceBranchId || !state.destinationBranchId) {
      context.addIssue({ code: "custom", path: ["sourceBranchId"], message: "Selecciona origen y destino." });
    }

    if (state.sourceBranchId === state.destinationBranchId) {
      context.addIssue({ code: "custom", path: ["destinationBranchId"], message: "La sucursal origen y destino no pueden ser la misma." });
    }
  }

  if ((state.kind === "exit" || state.kind === "transfer") && selectedBranchStock.value && state.quantity > selectedBranchStock.value.availableQuantity) {
    context.addIssue({
      code: "custom",
      path: ["quantity"],
      message: `Solo hay ${selectedBranchStock.value.availableQuantity} unidad(es) disponibles para operar.`,
    });
  }
}));

const submit = () => {
  if (state.kind === "transfer") {
    emits("submit", {
      kind: state.kind,
      payload: {
        sourceBranchId: state.sourceBranchId,
        destinationBranchId: state.destinationBranchId,
        productId: state.productId,
        quantity: state.quantity,
        reason: state.reason.trim(),
        note: state.note.trim(),
      },
    });
    return;
  }

  emits("submit", {
    kind: state.kind,
    payload: {
      branchId: state.branchId,
      productId: state.productId,
      mode: state.kind === "entry" ? "add" : state.kind === "exit" ? "remove" : "set",
      quantity: state.quantity,
      minStockLevel: state.minStockLevel,
      reason: state.reason.trim(),
      note: state.note.trim(),
    },
  });
};
</script>

<template>
  <UModal
    :open="open"
    title="Registrar movimiento"
    description="Registra ingresos, salidas, ajustes manuales o transferencias desde una sola accion operativa."
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4 md:space-y-5" @submit="submit">
        <UFormField label="Tipo de movimiento" name="kind">
          <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
            <select v-model="state.kind" class="min-h-10 w-full bg-transparent text-sm outline-none" :disabled="loading">
              <option value="entry">Ingreso</option>
              <option value="exit">Salida</option>
              <option value="adjustment">Ajuste manual</option>
              <option v-if="transferEnabled" value="transfer">Transferencia</option>
            </select>
          </div>
        </UFormField>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UFormField v-if="state.kind !== 'transfer'" label="Sucursal" name="branchId">
            <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <select v-model="state.branchId" class="min-h-10 w-full bg-transparent text-sm outline-none" :disabled="loading">
                <option value="">Selecciona una sucursal</option>
                <option v-for="branch in branches" :key="branch.id" :value="branch.id">
                  {{ branch.name }}{{ branch.code ? ` (${branch.code})` : "" }}
                </option>
              </select>
            </div>
          </UFormField>

          <UFormField v-if="state.kind === 'transfer'" label="Sucursal origen" name="sourceBranchId">
            <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <select v-model="state.sourceBranchId" class="min-h-10 w-full bg-transparent text-sm outline-none" :disabled="loading">
                <option value="">Selecciona sucursal origen</option>
                <option v-for="branch in branches" :key="branch.id" :value="branch.id">
                  {{ branch.name }}{{ branch.code ? ` (${branch.code})` : "" }}
                </option>
              </select>
            </div>
          </UFormField>

          <UFormField v-if="state.kind === 'transfer'" label="Sucursal destino" name="destinationBranchId">
            <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <select v-model="state.destinationBranchId" class="min-h-10 w-full bg-transparent text-sm outline-none" :disabled="loading">
                <option value="">Selecciona sucursal destino</option>
                <option v-for="branch in branches" :key="branch.id" :value="branch.id">
                  {{ branch.name }}{{ branch.code ? ` (${branch.code})` : "" }}
                </option>
              </select>
            </div>
          </UFormField>

          <UFormField label="Producto" name="productId">
            <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <select v-model="state.productId" class="min-h-10 w-full bg-transparent text-sm outline-none" :disabled="loading">
                <option value="">Selecciona un producto</option>
                <option v-for="product in products" :key="product.id" :value="product.id">
                  {{ product.name }}{{ product.sku ? ` (${product.sku})` : "" }}
                </option>
              </select>
            </div>
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UFormField label="Cantidad" name="quantity">
            <UInput v-model.number="state.quantity" type="number" min="1" :disabled="loading" :ui="{ base: 'min-h-11 text-base' }" />
          </UFormField>
        </div>

        <UFormField v-if="state.kind !== 'transfer'" label="Stock minimo" name="minStockLevel">
          <UInput v-model.number="state.minStockLevel" type="number" min="0" :disabled="loading" :ui="{ base: 'min-h-11 text-base' }" />
        </UFormField>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UFormField label="Motivo" name="reason">
            <UInput v-model="state.reason" placeholder="Ej. reposicion semanal" :disabled="loading" :ui="{ base: 'min-h-11 text-base' }" />
          </UFormField>

          <UFormField label="Nota interna" name="note">
            <UInput v-model="state.note" placeholder="Referencia opcional" :disabled="loading" :ui="{ base: 'min-h-11 text-base' }" />
          </UFormField>
        </div>

        <div
          v-if="selectedProduct"
          class="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
        >
          <p class="font-medium text-slate-950 dark:text-white">
            {{ selectedProduct.name }} - {{ branchLabel }}
          </p>
          <p class="mt-1">
            Stock: {{ selectedBranchStock?.quantity ?? 0 }} - Reservado: {{ selectedBranchStock?.reservedQuantity ?? 0 }} - Disponible: {{ selectedBranchStock?.availableQuantity ?? 0 }}
          </p>
        </div>

        <UiResponsiveModalActions>
          <UButton color="neutral" variant="ghost" block class="min-h-11 sm:w-auto" :disabled="loading" @click="emits('update:open', false)">
            Cancelar
          </UButton>
          <UButton type="submit" color="primary" block class="min-h-11 sm:w-auto" :loading="loading">
            Registrar movimiento
          </UButton>
        </UiResponsiveModalActions>
      </UForm>
    </template>
  </UModal>
</template>

