<script setup lang="ts">
import CategoryForm from "@/components/catalog/forms/CategoryForm.vue";

import type {
  CatalogCategoryItem,
  CatalogCategoryPayload,
} from "@/composables/useCatalog";

const props = withDefaults(defineProps<{
  open: boolean;
  loading?: boolean;
  type: "product" | "service";
  categories: CatalogCategoryItem[];
  initialValue?: CatalogCategoryItem | null;
}>(), {
  loading: false,
  initialValue: null,
});

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [CatalogCategoryPayload];
  cancel: [];
}>();

const formInitialValue = computed(() => {
  if (!props.initialValue) {
    return undefined;
  }

  return {
    name: props.initialValue.name,
    parentId: props.initialValue.parentId,
  };
});
</script>

<template>
  <UModal
    :open="props.open"
    :title="props.initialValue ? 'Editar categoría' : 'Nueva categoría'"
    :description="props.initialValue ? 'Actualiza la estructura del catálogo.' : 'Crea una categoría para productos o servicios.'"
    :ui="{ content: 'max-w-xl' }"
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <CategoryForm
        :loading="props.loading"
        :type="props.type"
        :categories="props.categories"
        :initial-value="formInitialValue"
        :submit-label="props.initialValue ? 'Guardar cambios' : 'Crear categoria'"
        @submit="emits('submit', $event)"
        @cancel="emits('cancel')"
      />
    </template>
  </UModal>
</template>
