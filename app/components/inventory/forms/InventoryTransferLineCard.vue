<script setup lang="ts">
import InventoryProductPicker from "@/components/inventory/forms/InventoryProductPicker.vue";
import AdminFieldGroup from "@/components/ui/forms/AdminFieldGroup.vue";
import AdminFieldHint from "@/components/ui/forms/AdminFieldHint.vue";
import AdminReadonlyField from "@/components/ui/forms/AdminReadonlyField.vue";
import AdminRepeaterCard from "@/components/ui/forms/AdminRepeaterCard.vue";
import type {
  InventoryProductRowView,
  InventoryTransferFormLine,
} from "@/utils/inventory";
import {
  getInventoryProductById,
  getInventoryTransferCurrentQuantity,
  getInventoryTransferWarning,
} from "@/utils/inventory";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

interface ProductPickerApi {
  closeDropdown: () => void;
}

const props = withDefaults(defineProps<{
  line: InventoryTransferFormLine;
  lineIndex: number;
  sourceBranchId: string;
  products: InventoryProductRowView[];
  excludedProductIds?: string[];
  canRemove?: boolean;
}>(), {
  excludedProductIds: () => [],
  canRemove: true,
});

const emits = defineEmits<{
  remove: [];
  "update:product-id": [string];
}>();

const productPicker = ref<ProductPickerApi | null>(null);

const selectedProductDisplay = computed(() => {
  const product = getInventoryProductById(props.products, props.line.productId);
  if (!product) {
    return "";
  }

  return product.sku ? `${product.name} (${product.sku})` : product.name;
});

const currentQuantity = computed(() => {
  return getInventoryTransferCurrentQuantity(props.line, props.sourceBranchId, props.products);
});

const transferWarning = computed(() => {
  return getInventoryTransferWarning(props.line, props.sourceBranchId, props.products);
});

const productFieldId = computed(() => `inventory-transfer-line-${props.lineIndex}-product`);
const quantityFieldId = computed(() => `inventory-transfer-line-${props.lineIndex}-quantity`);

function handleProductUpdate(productId: string) {
  emits("update:product-id", productId);
}

function closeDropdown() {
  productPicker.value?.closeDropdown();
}

defineExpose({
  closeDropdown,
});
</script>

<template>
  <AdminRepeaterCard
    :title="`Producto ${lineIndex + 1}`"
    :description="line.productId ? selectedProductDisplay : 'Selecciona un producto para esta línea.'"
  >
    <template #actions>
      <UButton
        size="sm"
        color="error"
        variant="ghost"
        class="h-11 w-11 justify-center rounded-2xl p-0"
        :disabled="!canRemove"
        @click="emits('remove')"
      >
        <UIcon name="i-heroicons-trash" class="h-5 w-5" />
      </UButton>
    </template>

    <AdminFieldGroup :columns="1" compact>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <UFormField :label="`Producto ${lineIndex + 1}`" :name="`lines.${lineIndex}.productId`" class="sm:col-span-5">
          <InventoryProductPicker
            ref="productPicker"
            v-model="line.productId"
            :items="products"
            :excluded-ids="excludedProductIds"
            :disabled="!sourceBranchId"
            :input-id="productFieldId"
            :input-name="`lines.${lineIndex}.productId`"
            @update:model-value="handleProductUpdate"
          />
        </UFormField>

        <div class="sm:col-span-7">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AdminReadonlyField
              label="Disponible"
              :value="currentQuantity >= 0 ? String(currentQuantity) : '—'"
            />

            <UFormField :label="`Cantidad ${lineIndex + 1}`" :name="`lines.${lineIndex}.quantity`" class="sm:col-span-2">
              <UInput
                v-model.number="line.quantity"
                :id="quantityFieldId"
                :name="`lines.${lineIndex}.quantity`"
                type="number"
                min="1"
                class="w-full"
                :ui="ADMIN_FIELD_UI"
                :disabled="!line.productId"
                :color="transferWarning.active ? 'warning' : 'neutral'"
              />
            </UFormField>
          </div>

          <AdminFieldHint
            v-if="transferWarning.active"
            tone="warning"
            icon="i-heroicons-exclamation-triangle"
          >
            {{ transferWarning.message }}
          </AdminFieldHint>
        </div>
      </div>
    </AdminFieldGroup>
  </AdminRepeaterCard>
</template>
