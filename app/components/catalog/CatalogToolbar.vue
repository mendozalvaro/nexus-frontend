<script setup lang="ts">
const props = defineProps<{
  activeTab: "products" | "product-categories" | "services" | "service-categories" | "room-categories";
  searchQuery: string;
  productsCount: number;
  productCategoriesCount: number;
  servicesCount: number;
  serviceCategoriesCount: number;
  roomCategoriesCount: number;
}>();

const emits = defineEmits<{
  "update:searchQuery": [string];
  create: [];
  import: [];
  export: [];
}>();

const localQuery = computed({
  get: () => props.searchQuery,
  set: (value: string) => emits("update:searchQuery", value),
});

const summaryText = computed(() => {
  if (props.activeTab === "products") {
    return `${props.productsCount} producto(s)`;
  }

  if (props.activeTab === "product-categories") {
    return `${props.productCategoriesCount} categoria(s) de productos`;
  }

  if (props.activeTab === "services") {
    return `${props.servicesCount} servicio(s)`;
  }

  if (props.activeTab === "service-categories") {
    return `${props.serviceCategoriesCount} categoria(s) de servicios`;
  }

  return `${props.roomCategoriesCount} categoria(s) de habitaciones`;
});

const buttonLabel = computed(() => {
  if (props.activeTab === "products") {
    return "Nuevo producto";
  }

  if (props.activeTab === "product-categories") {
    return "Nueva categoria de producto";
  }

  if (props.activeTab === "services") {
    return "Nuevo servicio";
  }

  if (props.activeTab === "service-categories") {
    return "Nueva categoria de servicio";
  }

  return "Nueva categoria de habitacion";
});

const dropdownItems = computed(() => [
  [
    {
      label: "Importar datos",
      icon: "i-lucide-upload",
      onSelect: () => emits("import"),
    },
    {
      label: "Exportar catalogo",
      icon: "i-lucide-download",
      onSelect: () => emits("export"),
    },
  ],
]);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-end gap-2">
      <UDropdownMenu :items="dropdownItems">
        <UButton variant="outline" color="neutral" icon="i-lucide-more-vertical" aria-label="Opciones de importacion/exportacion" />
      </UDropdownMenu>

      <UButton color="primary" icon="i-lucide-plus" @click="emits('create')">
        {{ buttonLabel }}
      </UButton>
    </div>

    <UiSearchFilters title="Buscar en catalogo" description="Filtra por nombre, SKU, categoria o descripcion." surface>
      <template #controls>
        <UInput v-model="localQuery" icon="i-lucide-search" placeholder="Buscar..." :ui="{ base: 'min-h-11 text-base' }" />
      </template>
      <template #summary>
        {{ summaryText }}
      </template>
    </UiSearchFilters>
  </div>
</template>
