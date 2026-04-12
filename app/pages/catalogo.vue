<script setup lang="ts">
import { h, resolveComponent } from "vue";
import CategoryForm from "@/components/forms/CategoryForm.vue";
import ProductForm from "@/components/forms/ProductForm.vue";
import ServiceForm from "@/components/forms/ServiceForm.vue";

import type {
  CatalogCategoryItem,
  CatalogCategoryPayload,
  CatalogProductItem,
  CatalogProductPayload,
  CatalogServiceItem,
  CatalogServicePayload,
} from "@/composables/useCatalog";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "catalog.view",
  roles: ["admin", "manager"],
});

const activeTab = ref<"products" | "services" | "categories">("products");
const searchQuery = ref("");
const mutationLoading = ref(false);
const productModalOpen = ref(false);
const serviceModalOpen = ref(false);
const categoryModalOpen = ref(false);
const editingProduct = ref<CatalogProductItem | null>(null);
const editingService = ref<CatalogServiceItem | null>(null);
const editingCategory = ref<CatalogCategoryItem | null>(null);

const {
  loadCatalog,
  createProduct,
  updateProduct,
  updateProductStatus,
  createService,
  updateService,
  updateServiceStatus,
  createCategory,
  updateCategory,
  updateCategoryStatus,
} = useCatalog();
const { ensureTenantContext, uploadCatalogImage, resolveCatalogImage } = useCatalogMedia();

const { data, refresh } = await useAsyncData(
  "catalog-module",
  () => loadCatalog(),
  { server: false },
);

const catalog = computed(() => data.value ?? { products: [], services: [], categories: [] });
const productCategories = computed(() => catalog.value.categories.filter((category) => category.type === "product"));
const serviceCategories = computed(() => catalog.value.categories.filter((category) => category.type === "service"));
const editingProductInitial = computed(() => {
  if (!editingProduct.value) {
    return undefined;
  }

  return {
    ...editingProduct.value,
    sku: editingProduct.value.sku ?? "",
    description: editingProduct.value.description ?? "",
    imageUrl: editingProduct.value.imageUrl ?? "",
  };
});

const editingServiceInitial = computed(() => {
  if (!editingService.value) {
    return undefined;
  }

  return {
    ...editingService.value,
    description: editingService.value.description ?? "",
    imageUrl: editingService.value.imageUrl ?? "",
  };
});

const filteredProducts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return catalog.value.products;
  }

  return catalog.value.products.filter((item) =>
    [item.name, item.sku ?? "", item.categoryName ?? "", item.description ?? ""].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
});

const filteredServices = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return catalog.value.services;
  }

  return catalog.value.services.filter((item) =>
    [item.name, item.categoryName ?? "", item.description ?? ""].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
});

const filteredCategories = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return catalog.value.categories;
  }

  return catalog.value.categories.filter((item) =>
    [item.name, item.parentName ?? "", item.type].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
});

const openProductModal = (product?: CatalogProductItem) => {
  editingProduct.value = product ?? null;
  productModalOpen.value = true;
};

const openServiceModal = (service?: CatalogServiceItem) => {
  editingService.value = service ?? null;
  serviceModalOpen.value = true;
};

const openCategoryModal = (category?: CatalogCategoryItem) => {
  editingCategory.value = category ?? null;
  categoryModalOpen.value = true;
};

const handleProductSubmit = async (payload: CatalogProductPayload) => {
  mutationLoading.value = true;
  try {
    const nextPayload: CatalogProductPayload = { ...payload };
    if (payload.imageFile) {
      nextPayload.imageUrl = await uploadCatalogImage(payload.imageFile, "product", {
        cropSquare: payload.cropSquare,
      });
    }
    nextPayload.imageFile = null;

    if (editingProduct.value) {
      await updateProduct(editingProduct.value.id, nextPayload);
    } else {
      await createProduct(nextPayload);
    }
    productModalOpen.value = false;
    editingProduct.value = null;
    await refresh();
  } finally {
    mutationLoading.value = false;
  }
};

const handleServiceSubmit = async (payload: CatalogServicePayload) => {
  mutationLoading.value = true;
  try {
    const nextPayload: CatalogServicePayload = { ...payload };
    if (payload.imageFile) {
      nextPayload.imageUrl = await uploadCatalogImage(payload.imageFile, "service", {
        cropSquare: payload.cropSquare,
      });
    }
    nextPayload.imageFile = null;

    if (editingService.value) {
      await updateService(editingService.value.id, nextPayload);
    } else {
      await createService(nextPayload);
    }
    serviceModalOpen.value = false;
    editingService.value = null;
    await refresh();
  } finally {
    mutationLoading.value = false;
  }
};

const handleCategorySubmit = async (payload: CatalogCategoryPayload) => {
  mutationLoading.value = true;
  try {
    if (editingCategory.value) {
      await updateCategory(editingCategory.value.id, payload);
    } else {
      await createCategory(payload);
    }
    categoryModalOpen.value = false;
    editingCategory.value = null;
    await refresh();
  } finally {
    mutationLoading.value = false;
  }
};

const productColumns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "name",
      header: "Producto",
      cell: ({ row }: { row: { original: CatalogProductItem } }) =>
        h("div", { class: "flex items-center gap-3" }, [
          row.original.imageUrl
            ? h("img", { src: resolveCatalogImage(row.original.imageUrl, "product"), alt: row.original.name, class: "h-10 w-10 rounded-lg object-cover" })
            : h("img", { src: resolveCatalogImage(null, "product"), alt: "Placeholder de producto", class: "h-10 w-10 rounded-lg object-cover" }),
          h("div", { class: "space-y-1 min-w-0" }, [
            h("p", { class: "truncate font-medium text-slate-950 dark:text-white" }, row.original.name),
            h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, row.original.sku ?? "Sin SKU"),
          ]),
        ]),
    },
    {
      accessorKey: "categoryName",
      header: "Categoria",
      cell: ({ row }: { row: { original: CatalogProductItem } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, row.original.categoryName ?? "Sin categoria"),
    },
    {
      accessorKey: "salePrice",
      header: "Venta",
      cell: ({ row }: { row: { original: CatalogProductItem } }) =>
        h("span", { class: "text-sm font-medium text-slate-950 dark:text-white" }, `Bs ${row.original.salePrice.toFixed(2)}`),
    },
    {
      accessorKey: "trackInventory",
      header: "Inventario",
      cell: ({ row }: { row: { original: CatalogProductItem } }) =>
        h(UBadge, { color: row.original.trackInventory ? "primary" : "neutral", variant: "soft" }, () => row.original.trackInventory ? "Controlado" : "Libre"),
    },
    {
      accessorKey: "isActive",
      header: "Estado",
      cell: ({ row }: { row: { original: CatalogProductItem } }) =>
        h(UBadge, { color: row.original.isActive ? "success" : "neutral", variant: "soft" }, () => row.original.isActive ? "Activo" : "Inactivo"),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: CatalogProductItem } }) =>
        h("div", { class: "flex flex-col gap-2 sm:flex-row" }, [
          h(UButton, { size: "sm", color: "neutral", variant: "ghost", class: "min-h-10", onClick: () => openProductModal(row.original) }, () => "Editar"),
          h(UButton, { size: "sm", color: row.original.isActive ? "error" : "success", variant: "ghost", class: "min-h-10", onClick: async () => { await updateProductStatus(row.original.id, !row.original.isActive); await refresh(); } }, () => row.original.isActive ? "Desactivar" : "Activar"),
        ]),
    },
  ];
});

const serviceColumns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "name",
      header: "Servicio",
      cell: ({ row }: { row: { original: CatalogServiceItem } }) =>
        h("div", { class: "flex items-center gap-3" }, [
          row.original.imageUrl
            ? h("img", { src: resolveCatalogImage(row.original.imageUrl, "service"), alt: row.original.name, class: "h-10 w-10 rounded-lg object-cover" })
            : h("img", { src: resolveCatalogImage(null, "service"), alt: "Placeholder de servicio", class: "h-10 w-10 rounded-lg object-cover" }),
          h("div", { class: "space-y-1 min-w-0" }, [
            h("p", { class: "truncate font-medium text-slate-950 dark:text-white" }, row.original.name),
            h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, `${row.original.durationMinutes} min`),
          ]),
        ]),
    },
    {
      accessorKey: "categoryName",
      header: "Categoria",
      cell: ({ row }: { row: { original: CatalogServiceItem } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, row.original.categoryName ?? "Sin categoria"),
    },
    {
      accessorKey: "price",
      header: "Precio",
      cell: ({ row }: { row: { original: CatalogServiceItem } }) =>
        h("span", { class: "text-sm font-medium text-slate-950 dark:text-white" }, `Bs ${row.original.price.toFixed(2)}`),
    },
    {
      accessorKey: "isActive",
      header: "Estado",
      cell: ({ row }: { row: { original: CatalogServiceItem } }) =>
        h(UBadge, { color: row.original.isActive ? "success" : "neutral", variant: "soft" }, () => row.original.isActive ? "Activo" : "Inactivo"),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: CatalogServiceItem } }) =>
        h("div", { class: "flex flex-col gap-2 sm:flex-row" }, [
          h(UButton, { size: "sm", color: "neutral", variant: "ghost", class: "min-h-10", onClick: () => openServiceModal(row.original) }, () => "Editar"),
          h(UButton, { size: "sm", color: row.original.isActive ? "error" : "success", variant: "ghost", class: "min-h-10", onClick: async () => { await updateServiceStatus(row.original.id, !row.original.isActive); await refresh(); } }, () => row.original.isActive ? "Desactivar" : "Activar"),
        ]),
    },
  ];
});

const categoryColumns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "name",
      header: "Categoria",
      cell: ({ row }: { row: { original: CatalogCategoryItem } }) =>
        h("div", { class: "space-y-1" }, [
          h("p", { class: "font-medium text-slate-950 dark:text-white" }, row.original.name),
          h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, row.original.parentName ?? "Sin categoria padre"),
        ]),
    },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }: { row: { original: CatalogCategoryItem } }) =>
        h(UBadge, { color: row.original.type === "product" ? "primary" : "warning", variant: "soft" }, () => row.original.type === "product" ? "Producto" : "Servicio"),
    },
    {
      accessorKey: "linkedCount",
      header: "Elementos",
      cell: ({ row }: { row: { original: CatalogCategoryItem } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, `${row.original.linkedCount}`),
    },
    {
      accessorKey: "isActive",
      header: "Estado",
      cell: ({ row }: { row: { original: CatalogCategoryItem } }) =>
        h(UBadge, { color: row.original.isActive ? "success" : "neutral", variant: "soft" }, () => row.original.isActive ? "Activa" : "Inactiva"),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: CatalogCategoryItem } }) =>
        h("div", { class: "flex flex-col gap-2 sm:flex-row" }, [
          h(UButton, { size: "sm", color: "neutral", variant: "ghost", class: "min-h-10", onClick: () => openCategoryModal(row.original) }, () => "Editar"),
          h(UButton, { size: "sm", color: row.original.isActive ? "error" : "success", variant: "ghost", class: "min-h-10", onClick: async () => { await updateCategoryStatus(row.original.id, !row.original.isActive); await refresh(); } }, () => row.original.isActive ? "Desactivar" : "Activar"),
        ]),
    },
  ];
});

onMounted(async () => {
  await ensureTenantContext();
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiModuleHero
      eyebrow="Catalogo"
      title="Oferta comercial"
      description="Administra productos, servicios y categorias desde un modulo separado del control operativo de inventario."
      icon="i-lucide-box"
    >
      <template #actions>
        <UButton v-if="activeTab === 'products'" color="primary" icon="i-lucide-plus" @click="openProductModal()">
          Nuevo producto
        </UButton>
        <UButton v-else-if="activeTab === 'services'" color="primary" icon="i-lucide-plus" @click="openServiceModal()">
          Nuevo servicio
        </UButton>
        <UButton v-else color="primary" icon="i-lucide-plus" @click="openCategoryModal()">
          Nueva categoria
        </UButton>
      </template>
    </UiModuleHero>

    <div class="flex flex-wrap gap-2">
      <UButton :variant="activeTab === 'products' ? 'solid' : 'soft'" :color="activeTab === 'products' ? 'primary' : 'neutral'" @click="activeTab = 'products'">
        Productos
      </UButton>
      <UButton :variant="activeTab === 'services' ? 'solid' : 'soft'" :color="activeTab === 'services' ? 'primary' : 'neutral'" @click="activeTab = 'services'">
        Servicios
      </UButton>
      <UButton :variant="activeTab === 'categories' ? 'solid' : 'soft'" :color="activeTab === 'categories' ? 'primary' : 'neutral'" @click="activeTab = 'categories'">
        Categorias
      </UButton>
    </div>

    <UiSearchFilters title="Buscar en catalogo" description="Filtra por nombre, SKU, categoria o descripcion." surface>
      <template #controls>
        <UInput v-model="searchQuery" icon="i-lucide-search" placeholder="Buscar..." :ui="{ base: 'min-h-11 text-base' }" />
      </template>
      <template #summary>
        <template v-if="activeTab === 'products'">{{ filteredProducts.length }} producto(s)</template>
        <template v-else-if="activeTab === 'services'">{{ filteredServices.length }} servicio(s)</template>
        <template v-else>{{ filteredCategories.length }} categoria(s)</template>
      </template>
    </UiSearchFilters>

    <UiDataTable
      v-if="activeTab === 'products'"
      :data="filteredProducts"
      :columns="productColumns"
      :loading="false"
      empty="No hay productos en el catalogo."
      min-width-class="min-w-[66rem] rounded-[1.5rem]"
    />

    <UiDataTable
      v-else-if="activeTab === 'services'"
      :data="filteredServices"
      :columns="serviceColumns"
      :loading="false"
      empty="No hay servicios en el catalogo."
      min-width-class="min-w-[60rem] rounded-[1.5rem]"
    />

    <UiDataTable
      v-else
      :data="filteredCategories"
      :columns="categoryColumns"
      :loading="false"
      empty="No hay categorias en el catalogo."
      min-width-class="min-w-[54rem] rounded-[1.5rem]"
    />

    <UModal
      :open="productModalOpen"
      :title="editingProduct ? 'Editar producto' : 'Nuevo producto'"
      :description="editingProduct ? 'Actualiza informacion comercial y de control de inventario.' : 'Crea un producto para el catalogo. Su stock inicial sera 0.'"
      @update:open="productModalOpen = $event"
    >
      <template #body>
        <ProductForm
          :loading="mutationLoading"
          :categories="productCategories"
          :initial-value="editingProductInitial"
          :submit-label="editingProduct ? 'Guardar cambios' : 'Crear producto'"
          @submit="handleProductSubmit"
          @cancel="productModalOpen = false"
        />
      </template>
    </UModal>

    <UModal
      :open="serviceModalOpen"
      :title="editingService ? 'Editar servicio' : 'Nuevo servicio'"
      :description="editingService ? 'Actualiza informacion comercial del servicio.' : 'Crea un servicio sin mezclar aun su cobertura operativa.'"
      @update:open="serviceModalOpen = $event"
    >
      <template #body>
        <ServiceForm
          :loading="mutationLoading"
          :categories="serviceCategories"
          :initial-value="editingServiceInitial"
          :submit-label="editingService ? 'Guardar cambios' : 'Crear servicio'"
          @submit="handleServiceSubmit"
          @cancel="serviceModalOpen = false"
        />
      </template>
    </UModal>

    <UModal
      :open="categoryModalOpen"
      :title="editingCategory ? 'Editar categoria' : 'Nueva categoria'"
      :description="editingCategory ? 'Actualiza la estructura del catalogo.' : 'Crea una categoria para productos o servicios.'"
      @update:open="categoryModalOpen = $event"
    >
      <template #body>
        <CategoryForm
          :loading="mutationLoading"
          :type="editingCategory?.type ?? (activeTab === 'services' ? 'service' : 'product')"
          :categories="catalog.categories"
          :initial-value="editingCategory ?? undefined"
          :submit-label="editingCategory ? 'Guardar cambios' : 'Crear categoria'"
          @submit="handleCategorySubmit"
          @cancel="categoryModalOpen = false"
        />
      </template>
    </UModal>
  </div>
</template>
