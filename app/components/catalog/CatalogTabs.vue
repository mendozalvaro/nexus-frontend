<script setup lang="ts">
export type CatalogTab =
  | "summary"
  | "products"
  | "product-categories"
  | "services"
  | "service-categories"
  | "rooms"
  | "room-categories";

const props = defineProps<{
  modelValue: CatalogTab;
  showProducts?: boolean;
  showServices?: boolean;
  showRooms?: boolean;
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
    <UButton v-if="showProducts" :variant="props.modelValue === 'products' ? 'solid' : 'soft'" :color="props.modelValue === 'products' ? 'primary' : 'neutral'" @click="setTab('products')">
      Productos
    </UButton>
    <UButton v-if="showProducts" :variant="props.modelValue === 'product-categories' ? 'solid' : 'soft'" :color="props.modelValue === 'product-categories' ? 'primary' : 'neutral'" @click="setTab('product-categories')">
      Categorias Productos
    </UButton>
    <UButton v-if="showServices" :variant="props.modelValue === 'services' ? 'solid' : 'soft'" :color="props.modelValue === 'services' ? 'primary' : 'neutral'" @click="setTab('services')">
      Servicios
    </UButton>
    <UButton v-if="showServices" :variant="props.modelValue === 'service-categories' ? 'solid' : 'soft'" :color="props.modelValue === 'service-categories' ? 'primary' : 'neutral'" @click="setTab('service-categories')">
      Categorias Servicios
    </UButton>
    <UButton v-if="showRooms" :variant="props.modelValue === 'rooms' ? 'solid' : 'soft'" :color="props.modelValue === 'rooms' ? 'primary' : 'neutral'" @click="setTab('rooms')">
      Habitaciones
    </UButton>
    <UButton v-if="showRooms" :variant="props.modelValue === 'room-categories' ? 'solid' : 'soft'" :color="props.modelValue === 'room-categories' ? 'primary' : 'neutral'" @click="setTab('room-categories')">
      Categorias Habitaciones
    </UButton>
  </div>
</template>
