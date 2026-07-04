<script setup lang="ts">
import type { PublicCatalogResponse } from "@/types/public-catalog";

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type CategoryGroup = {
  id: string;
  name: string;
  subcategories: Array<{ id: string; name: string }>;
};

type ProductGroup = {
  id: string;
  name: string;
  uncategorized: PublicCatalogResponse["products"];
  subgroups: Array<{
    id: string;
    name: string;
    products: PublicCatalogResponse["products"];
  }>;
};

const props = defineProps<{
  catalog: PublicCatalogResponse;
  categories: CategoryGroup[];
  selectedCategory: string;
  selectedSubcategory: string;
  searchQuery: string;
  filteredProducts: PublicCatalogResponse["products"];
  groupedProducts: ProductGroup[];
  featuredProducts: PublicCatalogResponse["products"];
  recentlyAddedProducts: PublicCatalogResponse["products"];
  cartItems: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  whatsappUrl: string | null;
}>();

const emit = defineEmits<{
  "update:selectedCategory": [value: string];
  "update:selectedSubcategory": [value: string];
  "update:searchQuery": [value: string];
  "add-to-cart": [productId: string];
  "remove-from-cart": [productId: string];
  "clear-cart": [];
}>();

const heroInitials = computed(() =>
  props.catalog.organization.name
    .split(" ")
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase())
    .join(""),
);

const instagramUrl = computed(() => {
  const handle = props.catalog.marketing.instagram.trim();
  if (!handle) {
    return null;
  }

  return `https://instagram.com/${handle}`;
});

const currencyFormatter = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: props.catalog.organization.currencyCode ?? "BOB",
  minimumFractionDigits: 2,
});

const formatPrice = (value: number) => currencyFormatter.format(value);

const selectedCategoryMeta = computed(() =>
  props.categories.find((category) => category.id === props.selectedCategory) ?? null,
);
</script>

<template>
  <main class="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#fff7f1_0%,#fffaf7_32%,#f6ebe4_100%)] text-stone-900">
    <section class="relative isolate border-b border-stone-300/60">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(206,142,114,0.28),transparent_38%),radial-gradient(circle_at_top_right,rgba(127,87,74,0.12),transparent_30%)]" />
      <div class="relative mx-auto grid max-w-7xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-12">
        <div class="space-y-8">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <div
                class="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-stone-400/40 bg-white/75 text-sm tracking-[0.38em] text-stone-700 shadow-sm"
                :style="{ fontFamily: '\'Avenir Next\', \'Gill Sans\', \'Trebuchet MS\', sans-serif' }"
              >
                <img
                  v-if="catalog.organization.logoUrl"
                  :src="catalog.organization.logoUrl"
                  :alt="catalog.organization.name"
                  class="h-full w-full object-cover"
                >
                <span v-else>{{ heroInitials }}</span>
              </div>

              <div>
                <p
                  class="text-[11px] uppercase tracking-[0.42em] text-stone-500"
                  :style="{ fontFamily: '\'Avenir Next\', \'Gill Sans\', \'Trebuchet MS\', sans-serif' }"
                >
                  Moda Calida
                </p>
                <h1
                  class="text-2xl text-stone-900 sm:text-3xl"
                  :style="{ fontFamily: '\'Baskerville\', \'Didot\', \'Times New Roman\', serif' }"
                >
                  {{ catalog.organization.name }}
                </h1>
              </div>
            </div>

            <div class="hidden rounded-full border border-stone-300/70 bg-white/70 px-4 py-2 text-xs tracking-[0.24em] text-stone-600 md:block">
              Catalogo por temporada
            </div>
          </div>

          <div class="space-y-5">
            <p
              class="max-w-xl text-4xl leading-tight sm:text-5xl lg:text-6xl"
              :style="{ fontFamily: '\'Baskerville\', \'Didot\', \'Times New Roman\', serif' }"
            >
              {{ catalog.marketing.heroTitle }}
            </p>
            <p class="max-w-2xl text-sm leading-7 text-stone-700 sm:text-base">
              {{ catalog.marketing.heroSubtitle }}
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <a
              v-if="whatsappUrl"
              :href="whatsappUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex min-h-11 items-center rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
            >
              Pedir por WhatsApp
            </a>
            <a
              v-if="instagramUrl"
              :href="instagramUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex min-h-11 items-center rounded-full border border-stone-400/70 bg-white/70 px-6 py-3 text-sm font-medium text-stone-900 transition hover:bg-white"
            >
              Ver Instagram
            </a>
            <div class="inline-flex min-h-11 items-center rounded-full border border-stone-300/70 bg-white/60 px-5 py-3 text-sm text-stone-700">
              {{ catalog.marketing.city }} - {{ catalog.marketing.shippingMessage }}
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-3">
            <div class="rounded-[1.75rem] border border-stone-300/70 bg-white/75 p-5 shadow-sm">
              <p class="text-xs uppercase tracking-[0.3em] text-stone-500">Curaduria</p>
              <p class="mt-3 text-sm leading-6 text-stone-700">{{ catalog.marketing.seasonalNote }}</p>
            </div>
            <div class="rounded-[1.75rem] border border-stone-300/70 bg-white/75 p-5 shadow-sm">
              <p class="text-xs uppercase tracking-[0.3em] text-stone-500">Catalogo</p>
              <p class="mt-3 text-sm leading-6 text-stone-700">{{ filteredProducts.length }} prendas activas para compra por mensaje.</p>
            </div>
            <div class="rounded-[1.75rem] border border-stone-300/70 bg-white/75 p-5 shadow-sm">
              <p class="text-xs uppercase tracking-[0.3em] text-stone-500">Marca</p>
              <p class="mt-3 text-sm leading-6 text-stone-700">{{ catalog.marketing.about }}</p>
            </div>
          </div>
        </div>

        <div class="relative">
          <div class="rounded-[2rem] border border-stone-300/80 bg-white/80 p-4 shadow-[0_24px_60px_rgba(85,54,45,0.16)] backdrop-blur">
            <div class="grid grid-cols-2 gap-3">
              <article
                v-for="product in featuredProducts.slice(0, 4)"
                :key="product.id"
                class="overflow-hidden rounded-[1.5rem] bg-[#f9eee8]"
              >
                <div class="aspect-[0.82] overflow-hidden bg-stone-200">
                  <img
                    v-if="product.imageUrl"
                    :src="product.imageUrl"
                    :alt="product.name"
                    class="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
                  >
                  <div v-else class="flex h-full items-center justify-center bg-[linear-gradient(135deg,#eed6c8,#d8b3a2)] text-xs uppercase tracking-[0.4em] text-stone-700">
                    Moda
                  </div>
                </div>
                <div class="space-y-2 p-4">
                  <p class="text-xs uppercase tracking-[0.28em] text-stone-500">{{ product.categoryName ?? "Seleccion" }}</p>
                  <p
                    class="text-lg leading-tight text-stone-900"
                    :style="{ fontFamily: '\'Baskerville\', \'Didot\', \'Times New Roman\', serif' }"
                  >
                    {{ product.name }}
                  </p>
                  <p class="text-sm text-stone-700">{{ formatPrice(product.salePrice) }}</p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
      <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div class="space-y-6">
          <div class="rounded-[2rem] border border-stone-300/70 bg-white/80 p-5 shadow-sm">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p class="text-xs uppercase tracking-[0.32em] text-stone-500">Explora la boutique</p>
                <h2
                  class="mt-2 text-3xl text-stone-900"
                  :style="{ fontFamily: '\'Baskerville\', \'Didot\', \'Times New Roman\', serif' }"
                >
                  Looks pensados para clima cambiante y temporadas mixtas
                </h2>
              </div>

              <label class="block min-w-[220px]">
                <span class="sr-only">Buscar prenda</span>
                <input
                  :value="searchQuery"
                  type="search"
                  placeholder="Buscar vestido, blusa, set..."
                  class="min-h-11 w-full rounded-full border border-stone-300 bg-[#fff8f3] px-4 text-sm text-stone-800 outline-none ring-0 placeholder:text-stone-400 focus:border-stone-500"
                  @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
                >
              </label>
            </div>

            <div class="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-full px-4 py-2 text-sm transition"
                :class="selectedCategory === 'all'
                  ? 'bg-stone-900 text-white'
                  : 'border border-stone-300 bg-white text-stone-700 hover:border-stone-500'"
                @click="emit('update:selectedCategory', 'all')"
              >
                Todo
              </button>
              <button
                v-for="category in categories"
                :key="category.id"
                type="button"
                class="rounded-full px-4 py-2 text-sm transition"
                :class="selectedCategory === category.id
                  ? 'bg-stone-900 text-white'
                  : 'border border-stone-300 bg-white text-stone-700 hover:border-stone-500'"
                @click="emit('update:selectedCategory', category.id)"
              >
                {{ category.name }}
              </button>
            </div>

            <div v-if="selectedCategoryMeta?.subcategories.length" class="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-full px-4 py-2 text-xs uppercase tracking-[0.24em] transition"
                :class="selectedSubcategory === 'all'
                  ? 'bg-[#bd7f62] text-white'
                  : 'border border-stone-300 bg-[#fff8f3] text-stone-700 hover:border-stone-500'"
                @click="emit('update:selectedSubcategory', 'all')"
              >
                Todas las subcategorias
              </button>
              <button
                v-for="subcategory in selectedCategoryMeta.subcategories"
                :key="subcategory.id"
                type="button"
                class="rounded-full px-4 py-2 text-xs uppercase tracking-[0.24em] transition"
                :class="selectedSubcategory === subcategory.id
                  ? 'bg-[#bd7f62] text-white'
                  : 'border border-stone-300 bg-[#fff8f3] text-stone-700 hover:border-stone-500'"
                @click="emit('update:selectedSubcategory', subcategory.id)"
              >
                {{ subcategory.name }}
              </button>
            </div>
          </div>

          <div class="space-y-8">
            <section
              v-for="group in groupedProducts"
              :key="group.id"
              class="space-y-6 rounded-[2rem] border border-stone-300/60 bg-white/55 p-4 sm:p-6"
            >
              <div class="flex items-end justify-between gap-4 border-b border-stone-200/80 pb-4">
                <div>
                  <p class="text-xs uppercase tracking-[0.28em] text-stone-500">Categoria</p>
                  <h3
                    class="mt-2 text-3xl text-stone-900"
                    :style="{ fontFamily: '\'Baskerville\', \'Didot\', \'Times New Roman\', serif' }"
                  >
                    {{ group.name }}
                  </h3>
                </div>
                <p class="text-sm text-stone-600">
                  {{ group.uncategorized.length + group.subgroups.reduce((sum, subgroup) => sum + subgroup.products.length, 0) }} piezas
                </p>
              </div>

              <div v-if="group.uncategorized.length" class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <article
                  v-for="product in group.uncategorized"
                  :key="product.id"
                  class="group overflow-hidden rounded-[2rem] border border-stone-300/70 bg-white/85 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(110,76,66,0.18)]"
                >
                  <div class="aspect-[0.88] overflow-hidden bg-[#f2ddd2]">
                    <img
                      v-if="product.imageUrl"
                      :src="product.imageUrl"
                      :alt="product.name"
                      class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    >
                    <div v-else class="flex h-full items-center justify-center bg-[linear-gradient(135deg,#efd7c7,#ddb29a)] text-xs uppercase tracking-[0.38em] text-stone-700">
                      Prenda
                    </div>
                  </div>
                  <div class="space-y-4 p-5">
                    <div class="space-y-2">
                      <p class="text-xs uppercase tracking-[0.28em] text-stone-500">{{ product.categoryGroupName ?? "Capsula" }}</p>
                      <h4 class="text-2xl leading-tight text-stone-900" :style="{ fontFamily: '\'Baskerville\', \'Didot\', \'Times New Roman\', serif' }">
                        {{ product.name }}
                      </h4>
                      <p class="min-h-[3rem] text-sm leading-6 text-stone-700">{{ product.description }}</p>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <div>
                        <p class="text-xs uppercase tracking-[0.24em] text-stone-400">Precio</p>
                        <p class="text-lg font-medium text-stone-900">{{ formatPrice(product.salePrice) }}</p>
                      </div>
                      <button
                        type="button"
                        class="inline-flex min-h-11 items-center rounded-full bg-[#bd7f62] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#ab6d51]"
                        @click="emit('add-to-cart', product.id)"
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                </article>
              </div>

              <section
                v-for="subgroup in group.subgroups"
                :key="subgroup.id"
                class="space-y-4"
              >
                <div class="flex items-center justify-between gap-4">
                  <h4 class="text-lg uppercase tracking-[0.24em] text-stone-700">{{ subgroup.name }}</h4>
                  <span class="text-xs text-stone-500">{{ subgroup.products.length }} prendas</span>
                </div>

                <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  <article
                    v-for="product in subgroup.products"
                    :key="product.id"
                    class="group overflow-hidden rounded-[2rem] border border-stone-300/70 bg-white/85 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(110,76,66,0.18)]"
                  >
                    <div class="aspect-[0.88] overflow-hidden bg-[#f2ddd2]">
                      <img
                        v-if="product.imageUrl"
                        :src="product.imageUrl"
                        :alt="product.name"
                        class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      >
                      <div v-else class="flex h-full items-center justify-center bg-[linear-gradient(135deg,#efd7c7,#ddb29a)] text-xs uppercase tracking-[0.38em] text-stone-700">
                        Prenda
                      </div>
                    </div>

                    <div class="space-y-4 p-5">
                      <div class="space-y-2">
                        <p class="text-xs uppercase tracking-[0.28em] text-stone-500">{{ product.subcategoryName ?? product.categoryGroupName ?? "Capsula" }}</p>
                        <h5 class="text-2xl leading-tight text-stone-900" :style="{ fontFamily: '\'Baskerville\', \'Didot\', \'Times New Roman\', serif' }">
                          {{ product.name }}
                        </h5>
                        <p class="min-h-[3rem] text-sm leading-6 text-stone-700">{{ product.description }}</p>
                      </div>
                      <div class="flex items-center justify-between gap-3">
                        <div>
                          <p class="text-xs uppercase tracking-[0.24em] text-stone-400">Precio</p>
                          <p class="text-lg font-medium text-stone-900">{{ formatPrice(product.salePrice) }}</p>
                        </div>
                        <button
                          type="button"
                          class="inline-flex min-h-11 items-center rounded-full bg-[#bd7f62] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#ab6d51]"
                          @click="emit('add-to-cart', product.id)"
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              </section>
            </section>
          </div>

          <div
            v-if="filteredProducts.length === 0"
            class="rounded-[2rem] border border-dashed border-stone-300 bg-white/70 p-10 text-center text-sm text-stone-600"
          >
            No encontramos prendas con ese filtro.
          </div>
        </div>

        <aside class="lg:sticky lg:top-6 lg:self-start">
          <div class="rounded-[2rem] border border-stone-300/70 bg-[#fffaf6] p-5 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.32em] text-stone-500">Pedido rapido</p>
                <h3
                  class="mt-2 text-3xl text-stone-900"
                  :style="{ fontFamily: '\'Baskerville\', \'Didot\', \'Times New Roman\', serif' }"
                >
                  Tu seleccion
                </h3>
              </div>
              <div class="rounded-full bg-stone-900 px-3 py-2 text-sm text-white">
                {{ cartCount }}
              </div>
            </div>

            <div v-if="cartItems.length" class="mt-5 space-y-3">
              <div
                v-for="item in cartItems"
                :key="item.id"
                class="flex items-center justify-between gap-3 rounded-[1.4rem] border border-stone-200 bg-white/80 p-4"
              >
                <div>
                  <p class="text-sm font-medium text-stone-900">{{ item.name }}</p>
                  <p class="text-xs uppercase tracking-[0.24em] text-stone-400">x{{ item.quantity }}</p>
                </div>
                <div class="flex items-center gap-3">
                  <p class="text-sm text-stone-700">{{ formatPrice(item.price * item.quantity) }}</p>
                  <button
                    type="button"
                    class="text-xs uppercase tracking-[0.24em] text-stone-500 hover:text-stone-900"
                    @click="emit('remove-from-cart', item.id)"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            </div>

            <div v-else class="mt-5 rounded-[1.4rem] border border-dashed border-stone-300 p-5 text-sm leading-6 text-stone-600">
              Agrega prendas para preparar tu mensaje de compra.
            </div>

            <div class="mt-5 rounded-[1.4rem] border border-stone-200 bg-white/70 p-4">
              <div class="flex items-center justify-between gap-3">
                <p class="text-xs uppercase tracking-[0.32em] text-stone-500">Vista rapida</p>
                <span class="text-xs text-stone-500">Recien añadidos</span>
              </div>

              <div v-if="recentlyAddedProducts.length" class="mt-4 space-y-3">
                <div
                  v-for="product in recentlyAddedProducts"
                  :key="product.id"
                  class="flex items-center justify-between gap-3 rounded-[1rem] border border-stone-200 bg-[#fffaf6] p-3"
                >
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-stone-900">{{ product.name }}</p>
                    <p class="truncate text-xs uppercase tracking-[0.2em] text-stone-500">
                      {{ product.subcategoryName ?? product.categoryGroupName ?? "Seleccion" }}
                    </p>
                  </div>
                  <p class="shrink-0 text-sm text-stone-700">{{ formatPrice(product.salePrice) }}</p>
                </div>
              </div>

              <p v-else class="mt-4 text-sm text-stone-600">
                La vista rapida mostrara aqui las ultimas prendas que agregues.
              </p>
            </div>

            <div class="mt-6 space-y-4 border-t border-stone-200 pt-5">
              <div class="flex items-center justify-between text-sm text-stone-700">
                <span>Subtotal referencial</span>
                <span class="font-medium text-stone-900">{{ formatPrice(cartSubtotal) }}</span>
              </div>

              <a
                v-if="whatsappUrl"
                :href="whatsappUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
              >
                Solicitar pedido
              </a>

              <button
                type="button"
                class="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-stone-300 px-5 py-3 text-sm text-stone-700 transition hover:border-stone-500 hover:text-stone-900"
                @click="emit('clear-cart')"
              >
                Limpiar seleccion
              </button>

              <p class="text-xs leading-6 text-stone-500">
                El pedido se confirma por mensaje. Tallas, stock final y envio se coordinan directo con la tienda.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  </main>
</template>
