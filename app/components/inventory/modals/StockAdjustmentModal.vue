<script setup lang="ts">
import { z } from "zod";

import type {
  InventoryAdjustmentPayload,
  InventoryBranchOption,
  InventoryProductRowView,
} from "@/utils/inventory";
import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import AdminReadonlyField from "@/components/ui/forms/AdminReadonlyField.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

interface StockAdjustmentFormState {
  branchId: string;
  productId: string;
  mode: "set" | "add" | "remove";
  quantity: number;
  minStockLevel: number | null;
  reason: string;
  note: string;
}

const props = defineProps<{
  open: boolean;
  title: string;
  branches: InventoryBranchOption[];
  products: InventoryProductRowView[];
  loading?: boolean;
}>();

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [InventoryAdjustmentPayload];
}>();

const formId = "stock-adjustment-form";

const state = reactive<StockAdjustmentFormState>({
  branchId: "",
  productId: "",
  mode: "add",
  quantity: 1,
  minStockLevel: null,
  reason: "",
  note: "",
});

const selectedProduct = computed(() => {
  return props.products.find((product) => product.id === state.productId) ?? null;
});

const selectedBranch = computed(() => {
  return props.branches.find((branch) => branch.id === state.branchId) ?? null;
});

const productItems = computed(() =>
  props.products.map((product) => ({ ...product, description: product.sku ?? undefined })),
);

const currentQuantity = computed(() => {
  if (!selectedProduct.value || !selectedBranch.value) {
    return null;
  }

  const stockInfo = selectedProduct.value.stockByBranch.find(
    (stock) => stock.branchId === selectedBranch.value!.id,
  );

  return stockInfo ? stockInfo.quantity : 0;
});

const nextQuantity = computed(() => {
  if (currentQuantity.value === null) {
    return null;
  }

  switch (state.mode) {
    case "set":
      return state.quantity;
    case "add":
      return currentQuantity.value + state.quantity;
    case "remove":
      return currentQuantity.value - state.quantity;
    default:
      return currentQuantity.value;
  }
});

const schema = computed(() =>
  z.object({
    branchId: z.string().trim().min(1, "Selecciona una sucursal."),
    productId: z.string().trim().min(1, "Selecciona un producto."),
    mode: z.enum(["set", "add", "remove"]),
    quantity: z.coerce.number().int("La cantidad debe ser entera.").positive("La cantidad debe ser mayor a cero."),
    minStockLevel: z.union([z.number().int("El mínimo debe ser entero.").min(0, "El mínimo no puede ser negativo."), z.null()]),
    reason: z.string().trim().min(3, "Ingresa un motivo para el ajuste."),
    note: z.string().trim().max(240, "La nota no puede superar 240 caracteres."),
  }),
);

function resetForm() {
  state.branchId = "";
  state.productId = "";
  state.mode = "add";
  state.quantity = 1;
  state.minStockLevel = null;
  state.reason = "";
  state.note = "";
}

function handleSubmit() {
  emits("submit", {
    branchId: state.branchId,
    productId: state.productId,
    mode: state.mode,
    quantity: state.quantity,
    reason: state.reason.trim(),
    note: state.note.trim() || undefined,
    minStockLevel: state.minStockLevel ?? undefined,
  });
}

function handleOpenChange(openValue: boolean) {
  if (!openValue) {
    resetForm();
  }

  emits("update:open", openValue);
}
</script>

<template>
  <UModal
    :open="props.open"
    :title="props.title"
    description="Ajusta stock de un producto en una sucursal específica."
    @update:open="handleOpenChange"
  >
    <template #body>
      <UForm :id="formId" :schema="schema" :state="state" class="space-y-6" @submit="handleSubmit">
        <AdminFormSection
          title="Detalle del ajuste"
          description="Selecciona la sucursal, el producto y el tipo de movimiento."
        >
          <UFormField label="Sucursal" name="branchId">
            <USelect
              v-model="state.branchId"
              :items="props.branches"
              label-key="name"
              value-key="id"
              placeholder="Seleccionar"
              class="w-full"
              :ui="ADMIN_FIELD_UI"
            />
          </UFormField>

          <UFormField label="Producto" name="productId">
            <USelect
              v-model="state.productId"
              :items="productItems"
              label-key="name"
              value-key="id"
              placeholder="Seleccionar"
              class="w-full"
              :ui="ADMIN_FIELD_UI"
            />
          </UFormField>

          <UFormField label="Tipo de ajuste" name="mode">
            <USelect
              v-model="state.mode"
              :items="[
                { label: 'Agregar', value: 'add' },
                { label: 'Reducir', value: 'remove' },
                { label: 'Establecer', value: 'set' },
              ]"
              label-key="label"
              value-key="value"
              class="w-full"
              :ui="ADMIN_FIELD_UI"
            />
          </UFormField>

          <UFormField label="Cantidad" name="quantity">
            <UInput
              v-model.number="state.quantity"
              type="number"
              min="1"
              class="w-full"
              :ui="ADMIN_FIELD_UI"
            />
          </UFormField>
        </AdminFormSection>

        <AdminFormSection
          title="Stock"
          description="Revisa el efecto del ajuste antes de confirmarlo."
        >
          <AdminReadonlyField
            label="Stock actual"
            :value="currentQuantity !== null ? String(currentQuantity) : '—'"
          />

          <AdminReadonlyField
            label="Stock resultante"
            :value="nextQuantity !== null ? String(nextQuantity) : '—'"
          />

          <UFormField label="Nuevo nivel mínimo (opcional)" name="minStockLevel" class="sm:col-span-2">
            <UInput
              v-model.number="state.minStockLevel"
              type="number"
              min="0"
              placeholder="Mantener actual"
              class="w-full"
              :ui="ADMIN_FIELD_UI"
            />
          </UFormField>
        </AdminFormSection>

        <AdminFormSection
          title="Observaciones"
          description="Documenta el motivo operativo y cualquier referencia adicional."
        >
          <UFormField label="Motivo" name="reason" class="sm:col-span-2">
            <UTextarea
              v-model="state.reason"
              placeholder="Motivo del ajuste de inventario..."
              :rows="2"
              autoresize
              class="w-full"
              :ui="ADMIN_FIELD_UI"
            />
          </UFormField>

          <UFormField label="Nota (opcional)" name="note" class="sm:col-span-2">
            <UInput
              v-model="state.note"
              placeholder="Nota adicional..."
              class="w-full"
              :ui="ADMIN_FIELD_UI"
            />
          </UFormField>
        </AdminFormSection>
      </UForm>
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
          label="Ajustar stock"
          color="primary"
          type="submit"
          class="w-full rounded-2xl px-6 shadow-lg shadow-primary-500/20 sm:w-auto"
          :loading="props.loading"
          :form="formId"
        />
      </AdminFormActions>
    </template>
  </UModal>
</template>
