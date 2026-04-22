<script setup lang="ts">
import ServiceForm from "@/components/forms/ServiceForm.vue";

import type {
  CatalogCategoryItem,
  CatalogServiceItem,
  CatalogServicePayload,
} from "@/composables/useCatalog";

const props = withDefaults(defineProps<{
  open: boolean;
  loading?: boolean;
  categories: CatalogCategoryItem[];
  initialValue?: CatalogServiceItem | null;
}>(), {
  loading: false,
  initialValue: null,
});

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [CatalogServicePayload];
  cancel: [];
}>();

const formInitialValue = computed(() => {
  if (!props.initialValue) {
    return undefined;
  }

  return {
    ...props.initialValue,
    description: props.initialValue.description ?? "",
    imageUrl: props.initialValue.imageUrl ?? "",
  };
});
</script>

<template>
  <UModal
    :open="props.open"
    :title="props.initialValue ? 'Editar servicio' : 'Nuevo servicio'"
    :description="props.initialValue ? 'Actualiza informacion comercial del servicio.' : 'Crea un servicio sin mezclar aun su cobertura operativa.'"
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <ServiceForm
        :loading="props.loading"
        :categories="props.categories"
        :initial-value="formInitialValue"
        :submit-label="props.initialValue ? 'Guardar cambios' : 'Crear servicio'"
        @submit="emits('submit', $event)"
        @cancel="emits('cancel')"
      />
    </template>
  </UModal>
</template>
