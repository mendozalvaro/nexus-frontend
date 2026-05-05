<script setup lang="ts">
import { ref, computed } from "vue";
import type {
  InventoryTransferPayload,
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
  submit: [InventoryTransferPayload];
}>();

const sourceBranchId = ref("");
const destinationBranchId = ref("");
const productId = ref("");
const quantity = ref(1);
const observations = ref("");
const internalNote = ref("");

const selectedProduct = computed(() => {
  return props.products.find((product) => product.id === productId.value);
});

const sourceBranch = computed(() => {
  return props.branches.find((branch) => branch.id === sourceBranchId.value);
});

const productItems = computed(() =>
  props.products.map((p) => ({ ...p, description: p.sku ?? undefined }))
);

const availableQuantity = computed(() => {
  if (!selectedProduct.value || !sourceBranch.value) {
    return 0;
  }

  const stockInfo = selectedProduct.value.stockByBranch.find(
    (stock) => stock.branchId === sourceBranch.value!.id,
  );

  return stockInfo ? stockInfo.availableQuantity : 0;
});

const isValid = computed(() => {
  return (
    !!sourceBranchId.value &&
    !!destinationBranchId.value &&
    sourceBranchId.value !== destinationBranchId.value &&
    !!productId.value &&
    quantity.value > 0 &&
    quantity.value <= availableQuantity.value &&
    !!observations.value.trim()
  );
});

function resetForm() {
  sourceBranchId.value = "";
  destinationBranchId.value = "";
  productId.value = "";
  quantity.value = 1;
  observations.value = "";
  internalNote.value = "";
}

async function handleSubmit() {
  if (!isValid.value) {
    return;
  }

  const payload: InventoryTransferPayload = {
    sourceBranchId: sourceBranchId.value,
    destinationBranchId: destinationBranchId.value,
    productId: productId.value,
    quantity: quantity.value,
    observations: observations.value,
    internalNote: internalNote.value || undefined,
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
    description="Transfiere stock de un producto entre sucursales."
    @update:open="handleOpenChange"
  >
    <template #body>
      <form class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <USelect
            v-model="sourceBranchId"
            :items="props.branches"
            option-attribute="name"
            value-attribute="id"
            label="Sucursal de origen"
            placeholder="Seleccionar"
            :ui="{ base: 'min-h-11 text-base' }"
          />
          <USelect
            v-model="destinationBranchId"
            :items="props.branches.filter(b => b.id !== sourceBranchId)"
            option-attribute="name"
            value-attribute="id"
            label="Sucursal de destino"
            placeholder="Seleccionar"
            :ui="{ base: 'min-h-11 text-base' }"
          />
        </div>

        <USelect
          v-model="productId"
          :items="productItems.filter(p => 
            p.stockByBranch.some(s => 
              s.branchId === sourceBranchId && s.availableQuantity > 0
            )
          )"
          option-attribute="name"
          value-attribute="id"
          label="Producto"
          placeholder="Seleccionar"
          :ui="{ base: 'min-h-11 text-base' }"
        />

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UInput
            v-if="availableQuantity > 0"
            label="Disponible en origen"
            :placeholder="String(availableQuantity)"
            readonly
            disabled
            :ui="{ base: 'min-h-11 text-base' }"
          />
          <UInput
            v-model.number="quantity"
            label="Cantidad a transferir"
            type="number"
            min="1"
            :max="availableQuantity"
            :ui="{ base: 'min-h-11 text-base' }"
          />
        </div>

        <UTextarea
          v-model="observations"
          label="Observaciones"
          placeholder="Breve descripción de la transferencia..."
          :rows="2"
          autoresize
          :ui="{ base: 'text-base' }"
        />

        <UInput
          v-model="internalNote"
          label="Nota interna (opcional)"
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
          Transferir stock
        </UButton>
      </div>
    </template>
  </UModal>
</template>