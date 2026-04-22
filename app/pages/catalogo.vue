<script setup lang="ts">
import CatalogCategoriesTable from "@/components/catalog/CatalogCategoriesTable.vue";
import CatalogCategoryModal from "@/components/catalog/CatalogCategoryModal.vue";
import CatalogProductModal from "@/components/catalog/CatalogProductModal.vue";
import CatalogProductsTable from "@/components/catalog/CatalogProductsTable.vue";
import CatalogServicesTable from "@/components/catalog/CatalogServicesTable.vue";
import CatalogServiceModal from "@/components/catalog/CatalogServiceModal.vue";
import CatalogSummaryPanel from "@/components/catalog/CatalogSummaryPanel.vue";
import CatalogTabs from "@/components/catalog/CatalogTabs.vue";
import CatalogToolbar from "@/components/catalog/CatalogToolbar.vue";

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

type CatalogTab = "summary" | "products" | "services" | "categories";
const activeTab = ref<CatalogTab>("summary");
const searchQuery = ref("");
const mutationLoading = ref(false);
const mutationError = ref<string | null>(null);
const productModalOpen = ref(false);
const serviceModalOpen = ref(false);
const categoryModalOpen = ref(false);
const editingProduct = ref<CatalogProductItem | null>(null);
const editingService = ref<CatalogServiceItem | null>(null);
const editingCategory = ref<CatalogCategoryItem | null>(null);

const {
  loadProducts,
  loadServices,
  loadCategories,
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
const { ensureTenantContext, uploadCatalogImage } = useCatalogMedia();

const { data: productsData, refresh: refreshProducts, pending: pendingProducts } = await useAsyncData(
  "catalog-products",
  () => loadProducts(),
  { server: false },
);

const { data: servicesData, refresh: refreshServices, pending: pendingServices } = await useAsyncData(
  "catalog-services",
  () => loadServices(),
  { server: false },
);

const { data: categoriesData, refresh: refreshCategories, pending: pendingCategories } = await useAsyncData(
  "catalog-categories",
  () => loadCategories(),
  { server: false },
);

const categoryMap = computed(() => new Map((categoriesData.value ?? []).map((category) => [category.id, category])));

const products = computed(() =>
  (productsData.value ?? []).map((item) => ({
    ...item,
    categoryName: item.categoryId ? (categoryMap.value.get(item.categoryId)?.name ?? null) : null,
  })),
);

const services = computed(() =>
  (servicesData.value ?? []).map((item) => ({
    ...item,
    categoryName: item.categoryId ? (categoryMap.value.get(item.categoryId)?.name ?? null) : null,
  })),
);

const categories = computed(() => {
  const productsCountByCategory = new Map<string, number>();
  const servicesCountByCategory = new Map<string, number>();

  for (const product of products.value) {
    if (product.categoryId) {
      productsCountByCategory.set(product.categoryId, (productsCountByCategory.get(product.categoryId) ?? 0) + 1);
    }
  }

  for (const service of services.value) {
    if (service.categoryId) {
      servicesCountByCategory.set(service.categoryId, (servicesCountByCategory.get(service.categoryId) ?? 0) + 1);
    }
  }

  return (categoriesData.value ?? []).map((item) => ({
    ...item,
    linkedCount: item.type === "product"
      ? (productsCountByCategory.get(item.id) ?? 0)
      : (servicesCountByCategory.get(item.id) ?? 0),
  }));
});

const pending = computed(() => pendingProducts.value || pendingServices.value || pendingCategories.value);
const catalog = computed(() => ({ products: products.value, services: services.value, categories: categories.value }));
const productCategories = computed(() => catalog.value.categories.filter((category) => category.type === "product"));
const serviceCategories = computed(() => catalog.value.categories.filter((category) => category.type === "service"));

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

const closeProductModal = () => {
  productModalOpen.value = false;
};

const closeServiceModal = () => {
  serviceModalOpen.value = false;
};

const closeCategoryModal = () => {
  categoryModalOpen.value = false;
};

const resolveErrorMessage = (error: unknown, fallback: string) => {
  if (
    error
    && typeof error === "object"
    && "statusMessage" in error
    && typeof (error as { statusMessage?: unknown }).statusMessage === "string"
  ) {
    return (error as { statusMessage: string }).statusMessage;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const handleCreateForTab = () => {
  if (activeTab.value === "products") {
    openProductModal();
    return;
  }

  if (activeTab.value === "services") {
    openServiceModal();
    return;
  }

  if (activeTab.value === "categories") {
    openCategoryModal();
  }
};

const handleProductSubmit = async (payload: CatalogProductPayload) => {
  mutationLoading.value = true;
  mutationError.value = null;
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

    closeProductModal();
    editingProduct.value = null;
    await refreshProducts();
  } catch (error) {
    mutationError.value = resolveErrorMessage(error, "No se pudo crear/actualizar el producto.");
    console.error("[CATALOGO] Product submit failed:", error);
  } finally {
    mutationLoading.value = false;
  }
};

const handleServiceSubmit = async (payload: CatalogServicePayload) => {
  mutationLoading.value = true;
  mutationError.value = null;
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

    closeServiceModal();
    editingService.value = null;
    await refreshServices();
  } catch (error) {
    mutationError.value = resolveErrorMessage(error, "No se pudo crear/actualizar el servicio.");
    console.error("[CATALOGO] Service submit failed:", error);
  } finally {
    mutationLoading.value = false;
  }
};

const handleCategorySubmit = async (payload: CatalogCategoryPayload) => {
  mutationLoading.value = true;
  mutationError.value = null;
  try {
    if (editingCategory.value) {
      await updateCategory(editingCategory.value.id, payload);
    } else {
      await createCategory(payload);
    }

    closeCategoryModal();
    editingCategory.value = null;
    await refreshCategories();
  } catch (error) {
    mutationError.value = resolveErrorMessage(error, "No se pudo crear/actualizar la categoria.");
    console.error("[CATALOGO] Category submit failed:", error);
  } finally {
    mutationLoading.value = false;
  }
};

const handleToggleProductStatus = async ({ id, nextState }: { id: string; nextState: boolean }) => {
  mutationError.value = null;
  try {
    await updateProductStatus(id, nextState);
    await refreshProducts();
  } catch (error) {
    mutationError.value = resolveErrorMessage(error, "No se pudo actualizar el estado del producto.");
    console.error("[CATALOGO] Product status failed:", error);
  }
};

const handleToggleServiceStatus = async ({ id, nextState }: { id: string; nextState: boolean }) => {
  mutationError.value = null;
  try {
    await updateServiceStatus(id, nextState);
    await refreshServices();
  } catch (error) {
    mutationError.value = resolveErrorMessage(error, "No se pudo actualizar el estado del servicio.");
    console.error("[CATALOGO] Service status failed:", error);
  }
};

const handleToggleCategoryStatus = async ({ id, nextState }: { id: string; nextState: boolean }) => {
  mutationError.value = null;
  try {
    await updateCategoryStatus(id, nextState);
    await refreshCategories();
  } catch (error) {
    mutationError.value = resolveErrorMessage(error, "No se pudo actualizar el estado de la categoria.");
    console.error("[CATALOGO] Category status failed:", error);
  }
};

watch(
  () => productModalOpen.value,
  (open) => {
    if (!open) {
      editingProduct.value = null;
    }
  },
);

watch(
  () => serviceModalOpen.value,
  (open) => {
    if (!open) {
      editingService.value = null;
    }
  },
);

watch(
  () => categoryModalOpen.value,
  (open) => {
    if (!open) {
      editingCategory.value = null;
    }
  },
);

onMounted(async () => {
  await ensureTenantContext();
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <CatalogTabs v-model="activeTab" />

    <UAlert
      v-if="mutationError"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :title="mutationError"
    />

    <CatalogSummaryPanel
      v-if="activeTab === 'summary'"
      :products-count="catalog.products.length"
      :services-count="catalog.services.length"
      :categories-count="catalog.categories.length"
      @navigate="activeTab = $event"
    />

    <template v-else>
      <CatalogToolbar
        :active-tab="activeTab"
        :search-query="searchQuery"
        :products-count="filteredProducts.length"
        :services-count="filteredServices.length"
        :categories-count="filteredCategories.length"
        @update:search-query="searchQuery = $event"
        @create="handleCreateForTab"
      />

      <CatalogProductsTable
        v-if="activeTab === 'products'"
        :rows="filteredProducts"
        :loading="pending || mutationLoading"
        @edit="openProductModal"
        @toggle-status="handleToggleProductStatus"
      />

      <CatalogServicesTable
        v-else-if="activeTab === 'services'"
        :rows="filteredServices"
        :loading="pending || mutationLoading"
        @edit="openServiceModal"
        @toggle-status="handleToggleServiceStatus"
      />

      <CatalogCategoriesTable
        v-else-if="activeTab === 'categories'"
        :rows="filteredCategories"
        :loading="pending || mutationLoading"
        @edit="openCategoryModal"
        @toggle-status="handleToggleCategoryStatus"
      />
    </template>

    <CatalogProductModal
      :open="productModalOpen"
      :loading="mutationLoading"
      :categories="productCategories"
      :initial-value="editingProduct"
      @update:open="productModalOpen = $event"
      @submit="handleProductSubmit"
      @cancel="closeProductModal"
    />

    <CatalogServiceModal
      :open="serviceModalOpen"
      :loading="mutationLoading"
      :categories="serviceCategories"
      :initial-value="editingService"
      @update:open="serviceModalOpen = $event"
      @submit="handleServiceSubmit"
      @cancel="closeServiceModal"
    />

    <CatalogCategoryModal
      :open="categoryModalOpen"
      :loading="mutationLoading"
      :type="editingCategory?.type ?? (activeTab === 'services' ? 'service' : 'product')"
      :categories="catalog.categories"
      :initial-value="editingCategory"
      @update:open="categoryModalOpen = $event"
      @submit="handleCategorySubmit"
      @cancel="closeCategoryModal"
    />
  </div>
</template>
