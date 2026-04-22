<script setup lang="ts">
const props = defineProps<{
  activeTab: "products" | "services" | "categories";
  searchQuery: string;
  productsCount: number;
  servicesCount: number;
  categoriesCount: number;
}>();

const emits = defineEmits<{
  "update:searchQuery": [string];
  create: [];
}>();

const localQuery = computed({
  get: () => props.searchQuery,
  set: (value: string) => emits("update:searchQuery", value),
});

const summaryText = computed(() => {
  if (props.activeTab === "products") {
    return `${props.productsCount} producto(s)`;
  }

  if (props.activeTab === "services") {
    return `${props.servicesCount} servicio(s)`;
  }

  return `${props.categoriesCount} categoria(s)`;
});

const buttonLabel = computed(() => {
  if (props.activeTab === "products") {
    return "Nuevo producto";
  }

  if (props.activeTab === "services") {
    return "Nuevo servicio";
  }

  return "Nueva categoria";
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-end">
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
