<script setup lang="ts">
import { z } from "zod";

import type {
  InventoryAdjustmentPayload,
  InventoryBranchOption,
  InventoryProductRowView,
} from "@/composables/useInventory";

interface AdjustmentFormState {
  branchId: string;
  productId: string;
  mode: "set" | "add" | "remove";
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
  selectedProductId?: string | null;
  selectedBranchId?: string | null;
}>(), {
  loading: false,
  selectedProductId: null,
  selectedBranchId: null,
});

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [InventoryAdjustmentPayload];
}>();

const state = reactive<AdjustmentFormState>({
  branchId: "",
  productId: "",
  mode: "add",
  quantity: 1,
  minStockLevel: null,
  reason: "",
  note: "",
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    state.branchId = props.selectedBranchId ?? props.branches[0]?.id ?? "";
    state.productId = props.selectedProductId ?? props.products[0]?.id ?? "";
    state.mode = "add";
    state.quantity = 1;
    state.reason = "";
    state.note = "";

    const stock = props.products
      .find((product) => product.id === state.productId)
      ?.stockByBranch.find((item) => item.branchId === state.branchId);

    state.minStockLevel = stock?.minStockLevel ?? 5;
  },
  { immediate: true },
);

watch(
  [() => state.branchId, () => state.productId],
  () => {
    const stock = selectedStock.value;
    state.minStockLevel = stock?.minStockLevel ?? 5;
  },
);

const selectedProduct = computed(() => {
  return props.products.find((product) => product.id === state.productId) ?? null;
});

const selectedStock = computed(() => {
  return selectedProduct.value?.stockByBranch.find((item) => item.branchId === state.branchId) ?? null;
});

const schema = computed(() => z.object({
  branchId: z.string().uuid("Selecciona una sucursal valida."),
  productId: z.string().uuid("Selecciona un producto valido."),
  mode: z.enum(["set", "add", "remove"]),
  quantity: z.coerce.number().int("La cantidad debe ser entera.").positive("La cantidad debe ser mayor a cero."),
  minStockLevel: z.coerce.number().int("El minimo debe ser entero.").min(0, "El minimo no puede ser negativo.").nullable(),
  reason: z.string().trim().min(3, "Debes indicar el motivo del ajuste."),
  note: z.string().trim().max(240, "La nota no puede superar 240 caracteres."),
}).superRefine((value, context) => {
  if (value.mode === "remove" && selectedStock.value && value.quantity > selectedStock.value.quantity) {
    context.addIssue({
      code: "custom",
      path: ["quantity"],
      message: `Solo hay ${selectedStock.value.quantity} unidad(es) registradas para retirar.`,
    });
  }
}));

const submit = () => {
  emits("submit", {
    branchId: state.branchId,
    productId: state.productId,
    mode: state.mode,
    quantity: state.quantity,
    minStockLevel: state.minStockLevel,
    reason: state.reason.trim(),
    note: state.note.trim(),
  });
};
</script>

<template>
  <UModal
    :open="open"
    title="Ajustar stock"
    description="Registra entradas, salidas o conteos manuales sin permitir cantidades negativas."
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4 md:space-y-5" @submit="submit">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UFormField label="Sucursal" name="branchId">
            <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <select v-model="state.branchId" class="min-h-10 w-full bg-transparent text-sm outline-none" :disabled="loading">
                <option value="">Selecciona una sucursal</option>
                <option v-for="branch in branches" :key="branch.id" :value="branch.id">
                  {{ branch.name }} ({{ branch.code }})
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
          <UFormField label="Tipo de ajuste" name="mode">
            <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <select v-model="state.mode" class="min-h-10 w-full bg-transparent text-sm outline-none" :disabled="loading">
                <option value="add">Entrada</option>
                <option value="remove">Salida</option>
                <option value="set">Conteo / Reposicion exacta</option>
              </select>
            </div>
          </UFormField>

          <UFormField label="Cantidad" name="quantity">
            <UInput v-model.number="state.quantity" type="number" min="1" :disabled="loading" :ui="{ base: 'min-h-11 text-base' }" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UFormField label="Stock minimo" name="minStockLevel">
            <UInput v-model.number="state.minStockLevel" type="number" min="0" :disabled="loading" :ui="{ base: 'min-h-11 text-base' }" />
          </UFormField>

          <UFormField label="Motivo" name="reason">
            <UInput v-model="state.reason" placeholder="Ej. conteo de cierre" :disabled="loading" :ui="{ base: 'min-h-11 text-base' }" />
          </UFormField>
        </div>

        <UFormField label="Nota interna" name="note">
          <UTextarea
            v-model="state.note"
            :rows="3"
            placeholder="Referencia opcional para auditoria"
            :disabled="loading"
            :ui="{ base: 'text-base' }"
          />
        </UFormField>

        <div
          v-if="selectedProduct"
          class="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
        >
          <p class="font-medium text-slate-950 dark:text-white">
            {{ selectedProduct.name }}
          </p>
          <p class="mt-1">
            Stock actual: {{ selectedStock?.quantity ?? 0 }} · Reservado: {{ selectedStock?.reservedQuantity ?? 0 }} · Disponible: {{ selectedStock?.availableQuantity ?? 0 }}
          </p>
        </div>

        <UiResponsiveModalActions>
          <UButton color="neutral" variant="ghost" block class="min-h-11 sm:w-auto" :disabled="loading" @click="emits('update:open', false)">
            Cancelar
          </UButton>
          <UButton type="submit" color="primary" icon="i-lucide-package-plus" block class="min-h-11 sm:w-auto" :loading="loading">
            Registrar ajuste
          </UButton>
        </UiResponsiveModalActions>
      </UForm>
    </template>
  </UModal>
</template>
