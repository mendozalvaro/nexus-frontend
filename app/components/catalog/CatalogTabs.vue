<script setup lang="ts">
export type CatalogTab = "summary" | "products" | "services" | "categories";

const props = defineProps<{
  modelValue: CatalogTab;
}>();

const emits = defineEmits<{
  "update:modelValue": [CatalogTab];
}>();

const setTab = (tab: CatalogTab) => {
  emits("update:modelValue", tab);
};
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <UButton :variant="props.modelValue === 'summary' ? 'solid' : 'soft'" :color="props.modelValue === 'summary' ? 'primary' : 'neutral'" @click="setTab('summary')">
      Resumen
    </UButton>
    <UButton :variant="props.modelValue === 'products' ? 'solid' : 'soft'" :color="props.modelValue === 'products' ? 'primary' : 'neutral'" @click="setTab('products')">
      Productos
    </UButton>
    <UButton :variant="props.modelValue === 'services' ? 'solid' : 'soft'" :color="props.modelValue === 'services' ? 'primary' : 'neutral'" @click="setTab('services')">
      Servicios
    </UButton>
    <UButton :variant="props.modelValue === 'categories' ? 'solid' : 'soft'" :color="props.modelValue === 'categories' ? 'primary' : 'neutral'" @click="setTab('categories')">
      Categorias
    </UButton>
  </div>
</template>
