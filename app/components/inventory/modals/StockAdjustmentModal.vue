<script setup lang="ts">
import { ref, computed } from "vue";
import type {
  InventoryAdjustmentPayload,
  InventoryProductRowView,
  InventoryBranchOption,
} from "@/utils/inventory";

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

const branchId = ref("");
const productId = ref("");
const mode = ref<"set" | "add" | "remove">("add");
const quantity = ref(1);
const minStockLevel = ref<number | null>(null);
const reason = ref("");
const note = ref("");

const selectedProduct = computed(() => {
  return props.products.find((product) => product.id === productId.value);
});

const selectedBranch = computed(() => {
  return props.branches.find((branch) => branch.id === branchId.value);
});

const productItems = computed(() =>
  props.products.map((p) => ({ ...p, description: p.sku ?? undefined }))
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

  switch (mode.value) {
    case "set":
      return quantity.value;
    case "add":
      return currentQuantity.value + quantity.value;
    case "remove":
      return currentQuantity.value - quantity.value;
    default:
      return currentQuantity.value;
  }
});

const isValid = computed(() => {
  return (
    !!branchId.value &&
    !!productId.value &&
    quantity.value > 0 &&
    !!reason.value.trim()
  );
});

function resetForm() {
  branchId.value = "";
  productId.value = "";
  mode.value = "add";
  quantity.value = 1;
  minStockLevel.value = null;
  reason.value = "";
  note.value = "";
}

async function handleSubmit() {
  if (!isValid.value) {
    return;
  }

  const payload: InventoryAdjustmentPayload = {
    branchId: branchId.value,
    productId: productId.value,
    mode: mode.value,
    quantity: quantity.value,
    reason: reason.value,
    note: note.value || undefined,
    minStockLevel: minStockLevel.value ?? undefined,
  };

  emits("submit", payload);
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
      <form class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <USelect
            v-model="branchId"
            :items="props.branches"
            option-attribute="name"
            value-attribute="id"
            label="Sucursal"
            placeholder="Seleccionar"
            :ui="{ base: 'min-h-11 text-base' }"
          />
          <USelect
            v-model="productId"
            :items="productItems"
            option-attribute="name"
            value-attribute="id"
            label="Producto"
            placeholder="Seleccionar"
            :ui="{ base: 'min-h-11 text-base' }"
          />
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <USelect
            v-model="mode"
            :items="[
              { label: 'Agregar', value: 'add' },
              { label: 'Reducir', value: 'remove' },
              { label: 'Establecer', value: 'set' },
            ]"
            option-attribute="label"
            value-attribute="value"
            label="Tipo de ajuste"
            :ui="{ base: 'min-h-11 text-base' }"
          />
          <UInput
            v-model.number="quantity"
            label="Cantidad"
            type="number"
            min="1"
            :ui="{ base: 'min-h-11 text-base' }"
          />
        </div>

        <UInput
          v-if="currentQuantity !== null"
          label="Stock actual"
          :placeholder="String(currentQuantity)"
          readonly
          disabled
          :ui="{ base: 'min-h-11 text-base' }"
        />

        <UInput
          v-if="nextQuantity !== null"
          label="Stock resultante"
          :placeholder="String(nextQuantity)"
          readonly
          :ui="{ base: 'min-h-11 text-base' }"
        />

        <UInput
          v-model.number="minStockLevel"
          label="Nuevo nivel mínimo (opcional)"
          type="number"
          min="0"
          placeholder="Mantener actual"
          :ui="{ base: 'min-h-11 text-base' }"
        />

        <UTextarea
          v-model="reason"
          label="Motivo"
          placeholder="Motivo del ajuste de inventario..."
          :rows="2"
          autoresize
          :ui="{ base: 'text-base' }"
        />

        <UInput
          v-model="note"
          label="Nota (opcional)"
          placeholder="Nota adicional..."
          :ui="{ base: 'min-h-11 text-base' }"
        />
      </form>
    </template>

    <template #footer>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <UButton
          color="neutral"
          variant="outline"
          @click="handleOpenChange(false)"
        >
          Cancelar
        </UButton>
        <UButton
          color="primary"
          variant="solid"
          :disabled="!isValid || props.loading"
          @click="handleSubmit"
        >
          Ajustar stock
        </UButton>
      </div>
    </template>
  </UModal>
</template>