<script setup lang="ts">
import PublicClothingStorefront from "@/components/catalog/PublicClothingStorefront.vue";
import type { PublicCatalogProduct, PublicCatalogResponse } from "@/types/public-catalog";

const route = useRoute();
const { loadCatalogBySlug } = usePublicCatalog();

const slug = computed(() => {
  const value = route.params.slug;
  return typeof value === "string" ? value.trim().toLowerCase() : "";
});

const searchQuery = ref("");
const selectedCategory = ref("all");
const selectedSubcategory = ref("all");
const cart = ref<Record<string, number>>({});
const recentAddedIds = ref<string[]>([]);

definePageMeta({
  layout: false,
  publicStorefront: true,
});

const { data: catalog, pending, error } = await useAsyncData(
  () => `public-catalog-${slug.value}`,
  () => loadCatalogBySlug(slug.value),
  {
    watch: [slug],
  },
);

const currentCatalog = computed<PublicCatalogResponse | null>(() => catalog.value ?? null);

watch(slug, () => {
  selectedCategory.value = "all";
  selectedSubcategory.value = "all";
  searchQuery.value = "";
  cart.value = {};
  recentAddedIds.value = [];
});

watch(selectedCategory, () => {
  selectedSubcategory.value = "all";
});

const categoryHierarchy = computed(() => {
  const categories = currentCatalog.value?.categories ?? [];
  const topLevel = categories.filter((category) => !category.parentId);
  const childByParent = new Map<string, Array<{ id: string; name: string }>>();

  for (const category of categories) {
    if (!category.parentId) {
      continue;
    }

    const list = childByParent.get(category.parentId) ?? [];
    list.push({ id: category.id, name: category.name });
    childByParent.set(category.parentId, list);
  }

  return topLevel.map((category) => ({
    id: category.id,
    name: category.name,
    subcategories: childByParent.get(category.id) ?? [],
  }));
});

const filteredProducts = computed(() => {
  const products = currentCatalog.value?.products ?? [];
  const normalizedQuery = searchQuery.value.trim().toLowerCase();

  return products.filter((product) => {
    const matchesCategory = selectedCategory.value === "all" || product.categoryGroupId === selectedCategory.value;
    if (!matchesCategory) {
      return false;
    }

    const matchesSubcategory = selectedSubcategory.value === "all" || product.subcategoryId === selectedSubcategory.value;
    if (!matchesSubcategory) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      product.name,
      product.description ?? "",
      product.categoryGroupName ?? "",
      product.subcategoryName ?? "",
      product.sku ?? "",
    ].some((value) => value.toLowerCase().includes(normalizedQuery));
  });
});

const featuredProducts = computed(() => (currentCatalog.value?.products ?? []).slice(0, 4));
const recentlyAddedProducts = computed(() => {
  const productsById = new Map((currentCatalog.value?.products ?? []).map((product) => [product.id, product]));
  return recentAddedIds.value
    .map((productId) => productsById.get(productId) ?? null)
    .filter((product): product is NonNullable<typeof product> => Boolean(product));
});

const groupedProducts = computed(() => {
  const groups = new Map<string, {
    id: string;
    name: string;
    subgroups: Map<string, { id: string; name: string; products: PublicCatalogProduct[] }>;
    uncategorized: PublicCatalogProduct[];
  }>();

  for (const product of filteredProducts.value) {
    const categoryId = product.categoryGroupId ?? "uncategorized";
    const categoryName = product.categoryGroupName ?? "Seleccion general";
    const currentGroup = groups.get(categoryId) ?? {
      id: categoryId,
      name: categoryName,
      subgroups: new Map(),
      uncategorized: [] as PublicCatalogProduct[],
    };

    if (product.subcategoryId && product.subcategoryName) {
      const subgroup = currentGroup.subgroups.get(product.subcategoryId) ?? {
        id: product.subcategoryId,
        name: product.subcategoryName,
        products: [] as PublicCatalogProduct[],
      };
      subgroup.products.push(product);
      currentGroup.subgroups.set(product.subcategoryId, subgroup);
    } else {
      currentGroup.uncategorized.push(product);
    }

    groups.set(categoryId, currentGroup);
  }

  return Array.from(groups.values()).map((group) => ({
    id: group.id,
    name: group.name,
    uncategorized: group.uncategorized,
    subgroups: Array.from(group.subgroups.values()),
  }));
});

const cartItems = computed(() => {
  const productsById = new Map((currentCatalog.value?.products ?? []).map((product) => [product.id, product]));

  return Object.entries(cart.value)
    .map(([productId, quantity]) => {
      const product = productsById.get(productId);
      if (!product || quantity <= 0) {
        return null;
      }

      return {
        id: product.id,
        name: product.name,
        price: product.salePrice,
        quantity,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
});

const cartCount = computed(() => cartItems.value.reduce((total, item) => total + item.quantity, 0));
const cartSubtotal = computed(() => cartItems.value.reduce((total, item) => total + (item.price * item.quantity), 0));

const whatsappUrl = computed(() => {
  const phone = currentCatalog.value?.marketing.whatsapp?.replace(/\D/g, "") ?? "";
  if (!phone) {
    return null;
  }

  const lines = cartItems.value.length
    ? cartItems.value.map((item) => `- ${item.name} x${item.quantity}`)
    : ["- Quiero recibir asesoria sobre la coleccion actual"];
  const message = [
    `Hola ${currentCatalog.value?.organization.name ?? "Moda Calida"},`,
    "Quiero hacer un pedido desde el catalogo web:",
    ...lines,
    `Subtotal referencial: ${cartSubtotal.value.toFixed(2)}`,
    `Slug tienda: ${currentCatalog.value?.organization.slug ?? slug.value}`,
  ].join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
});

const addToCart = (productId: string) => {
  cart.value = {
    ...cart.value,
    [productId]: (cart.value[productId] ?? 0) + 1,
  };

  recentAddedIds.value = [
    productId,
    ...recentAddedIds.value.filter((existingId) => existingId !== productId),
  ].slice(0, 4);
};

const removeFromCart = (productId: string) => {
  const currentQuantity = cart.value[productId] ?? 0;
  if (currentQuantity <= 1) {
    const nextCart = { ...cart.value };
    delete nextCart[productId];
    cart.value = nextCart;
    return;
  }

  cart.value = {
    ...cart.value,
    [productId]: currentQuantity - 1,
  };
};

const clearCart = () => {
  cart.value = {};
};

useSeoMeta({
  title: () => currentCatalog.value ? `${currentCatalog.value.organization.name} | Boutique online` : "Catalogo de tienda",
  description: () => currentCatalog.value?.marketing.heroSubtitle ?? "Catalogo publico por organizacion.",
  ogTitle: () => currentCatalog.value ? `${currentCatalog.value.organization.name} | Moda Calida` : "Catalogo de tienda",
  ogDescription: () => currentCatalog.value?.marketing.about ?? "Catalogo publico por organizacion.",
});
</script>

<template>
  <div v-if="pending" class="flex min-h-screen items-center justify-center bg-[#fff8f3] px-6 text-stone-600">
    Cargando catalogo...
  </div>

  <div v-else-if="error || !currentCatalog" class="flex min-h-screen items-center justify-center bg-[#fff8f3] px-6">
    <section class="max-w-lg rounded-[2rem] border border-stone-300/70 bg-white/85 p-10 text-center shadow-sm">
      <p class="text-xs uppercase tracking-[0.3em] text-stone-500">Catalogo publico</p>
      <h1
        class="mt-3 text-4xl text-stone-900"
        :style="{ fontFamily: '\'Baskerville\', \'Didot\', \'Times New Roman\', serif' }"
      >
        Tienda no disponible
      </h1>
      <p class="mt-4 text-sm leading-7 text-stone-700">
        No pudimos cargar esta boutique. Verifica el slug o activa la tienda demo.
      </p>
    </section>
  </div>

  <PublicClothingStorefront
    v-else
    :catalog="currentCatalog"
    :categories="categoryHierarchy"
    :selected-category="selectedCategory"
    :selected-subcategory="selectedSubcategory"
    :search-query="searchQuery"
    :filtered-products="filteredProducts"
    :grouped-products="groupedProducts"
    :featured-products="featuredProducts"
    :recently-added-products="recentlyAddedProducts"
    :cart-items="cartItems"
    :cart-count="cartCount"
    :cart-subtotal="cartSubtotal"
    :whatsapp-url="whatsappUrl"
    @update:selected-category="selectedCategory = $event"
    @update:selected-subcategory="selectedSubcategory = $event"
    @update:search-query="searchQuery = $event"
    @add-to-cart="addToCart"
    @remove-from-cart="removeFromCart"
    @clear-cart="clearCart"
  />
</template>
