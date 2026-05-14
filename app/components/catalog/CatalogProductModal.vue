<script setup lang="ts">
import ProductForm from "@/components/catalog/forms/ProductForm.vue";

import type {
  CatalogCategoryItem,
  CatalogProductItem,
  CatalogProductPayload,
} from "@/composables/useCatalog";

const props = withDefaults(defineProps<{
  open: boolean;
  loading?: boolean;
  categories: CatalogCategoryItem[];
  initialValue?: CatalogProductItem | null;
}>(), {
  loading: false,
  initialValue: null,
});

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [CatalogProductPayload];
  cancel: [];
}>();

const formInitialValue = computed(() => {
  if (!props.initialValue) {
    return undefined;
  }

  return {
    ...props.initialValue,
    sku: props.initialValue.sku ?? "",
    description: props.initialValue.description ?? "",
    imageUrl: props.initialValue.imageUrl ?? "",
  };
});
</script>

<template>
  <UModal
    :open="props.open"
    :title="props.initialValue ? 'Editar producto' : 'Nuevo producto'"
    :description="props.initialValue ? 'Actualiza información comercial y de control de inventario.' : 'Crea un producto para el catálogo. Su stock inicial será 0.'"
    :ui="{ content: 'max-w-2xl' }"
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <ProductForm
        :loading="props.loading"
        :categories="props.categories"
        :initial-value="formInitialValue"
        :submit-label="props.initialValue ? 'Guardar cambios' : 'Crear producto'"
        @submit="emits('submit', $event)"
        @cancel="emits('cancel')"
      />
    </template>
  </UModal>
</template>
