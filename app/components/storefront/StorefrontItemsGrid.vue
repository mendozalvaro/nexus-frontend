<script setup lang="ts">
import type { PublicStorefrontItem, PublicStorefrontResponse, StorefrontItemLayout } from "@/types/storefront";
import { getInitialsPlaceholder } from "@/utils/storefront";

interface LayoutConfig {
  heroRounded: string;
  heroPadding: string;
  cardRounded: string;
  cardShadow: string;
  cardHover: string;
  gridCols: string;
  gridGap: string;
  showCategoryBadge: boolean;
  heroDecoration: "none" | "pattern" | "glass" | "avatar";
  itemLayout: StorefrontItemLayout;
  heroLayout: "left" | "centered" | "split";
  heroGradient: string;
  heroTitleSize: string;
  heroSubtitleSize: string;
  heroCentered: boolean;
}

const props = defineProps<{
  storefront: PublicStorefrontResponse;
  layout: LayoutConfig;
  headingStyle: Record<string, string>;
  itemBorderStyle: Record<string, string>;
  priceFormatter: Intl.NumberFormat;
  sectionTitle: string;
  currencyCode: string;
  items: PublicStorefrontItem[];
}>();

const emit = defineEmits<{
  "open-gallery": [index: number];
}>();

const galleryItems = computed(() => props.items.filter((item) => item.imageUrl));

const getGalleryIndex = (itemId: string) => {
  return galleryItems.value.findIndex((item) => item.id === itemId);
};

const { observe: observeItem, getStyle: getItemStyle } = useScrollReveal({ delay: 150, stagger: 100 });
const itemRefs = ref<(HTMLElement | null)[]>([]);

const primaryColor = computed(() => props.storefront.settings.primaryColor);
const accentColor = computed(() => props.storefront.settings.accentColor);

const getItemImage = (item: PublicStorefrontItem) => {
  return item.imageUrl ?? getInitialsPlaceholder(item.title, accentColor.value);
};

const setItemRef = (el: HTMLElement | null, index: number) => {
  itemRefs.value[index] = el;
  observeItem(el);
};

const carouselRef = ref<HTMLElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);

const updateCarouselButtons = () => {
  if (!carouselRef.value) return;
  const el = carouselRef.value;
  canScrollLeft.value = el.scrollLeft > 4;
  canScrollRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 4;
};

const scrollCarousel = (direction: "left" | "right") => {
  if (!carouselRef.value) return;
  const amount = carouselRef.value.clientWidth * 0.7;
  carouselRef.value.scrollBy({
    left: direction === "left" ? -amount : amount,
    behavior: "smooth",
  });
};

onMounted(() => {
  if (props.layout.itemLayout === "carousel") {
    updateCarouselButtons();
  }
});
</script>

<template>
  <div v-if="props.items.length">

    <!-- CARD-GRID -->
    <template v-if="layout.itemLayout === 'card-grid'">
      <div :class="`grid ${layout.gridGap} ${layout.gridCols}`">
        <article
          v-for="(item, idx) in props.items"
          :key="item.id"
          :ref="(el: any) => setItemRef(el as HTMLElement | null, idx)"
          :style="getItemStyle(itemRefs[idx] ?? null, idx)"
          :class="[
            'overflow-hidden border border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-950',
            layout.cardRounded,
            layout.cardShadow,
            layout.cardHover,
          ]"
        >
          <div class="aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-900">
            <img :src="getItemImage(item)" :alt="item.title" class="h-full w-full cursor-pointer object-cover transition-transform duration-500 hover:scale-105" @click="emit('open-gallery', getGalleryIndex(item.id))" />
          </div>
          <div class="space-y-3 p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-lg font-semibold text-slate-900 dark:text-white" :style="headingStyle">{{ item.title }}</p>
                <p v-if="item.subtitle" class="text-sm text-slate-500 dark:text-slate-400">{{ item.subtitle }}</p>
              </div>
              <UBadge v-if="item.badge && layout.showCategoryBadge" color="neutral" variant="soft">{{ item.badge }}</UBadge>
            </div>
            <p v-if="item.description" class="text-sm leading-6 text-slate-600 dark:text-slate-300">{{ item.description }}</p>
            <div class="flex items-center justify-between gap-3 border-t pt-3" :style="itemBorderStyle">
              <p class="text-sm text-slate-500 dark:text-slate-400">{{ item.meta || "Disponible" }}</p>
              <p v-if="item.price !== null" class="text-base font-semibold transition-colors duration-300" :style="{ color: primaryColor }">
                {{ priceFormatter.format(item.price) }}
              </p>
            </div>
          </div>
        </article>
      </div>
    </template>

    <!-- LIST-ROW -->
    <template v-else-if="layout.itemLayout === 'list-row'">
      <div class="space-y-3">
        <article
          v-for="(item, idx) in props.items"
          :key="item.id"
          :ref="(el: any) => setItemRef(el as HTMLElement | null, idx)"
          :style="getItemStyle(itemRefs[idx] ?? null, idx)"
          :class="[
            'flex gap-4 overflow-hidden border border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-950',
            layout.cardRounded,
            layout.cardShadow,
            layout.cardHover,
          ]"
        >
          <div class="h-28 w-28 shrink-0 overflow-hidden bg-slate-100 sm:h-32 sm:w-32 dark:bg-slate-900">
            <img :src="getItemImage(item)" :alt="item.title" class="h-full w-full cursor-pointer object-cover transition-transform duration-500 hover:scale-105" @click="emit('open-gallery', getGalleryIndex(item.id))" />
          </div>
          <div class="flex flex-1 flex-col justify-center gap-1 py-3 pr-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-base font-semibold text-slate-900 dark:text-white" :style="headingStyle">{{ item.title }}</p>
                <p v-if="item.subtitle" class="text-sm text-slate-500 dark:text-slate-400">{{ item.subtitle }}</p>
              </div>
              <UBadge v-if="item.badge && layout.showCategoryBadge" color="neutral" variant="soft" class="shrink-0">{{ item.badge }}</UBadge>
            </div>
            <p v-if="item.description" class="line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{{ item.description }}</p>
            <div class="mt-auto flex items-center justify-between gap-3 pt-1">
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ item.meta || "Disponible" }}</p>
              <p v-if="item.price !== null" class="text-sm font-semibold transition-colors duration-300" :style="{ color: primaryColor }">
                {{ priceFormatter.format(item.price) }}
              </p>
            </div>
          </div>
        </article>
      </div>
    </template>

    <!-- COMPACT -->
    <template v-else-if="layout.itemLayout === 'compact'">
      <div :class="`grid ${layout.gridGap} ${layout.gridCols}`">
        <article
          v-for="(item, idx) in props.items"
          :key="item.id"
          :ref="(el: any) => setItemRef(el as HTMLElement | null, idx)"
          :style="getItemStyle(itemRefs[idx] ?? null, idx)"
          :class="[
            'overflow-hidden border border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-950',
            layout.cardRounded,
          ]"
        >
          <div class="aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-900">
            <img :src="getItemImage(item)" :alt="item.title" class="h-full w-full cursor-pointer object-cover transition-transform duration-500 hover:scale-105" @click="emit('open-gallery', getGalleryIndex(item.id))" />
          </div>
          <div class="space-y-1 p-3">
            <div class="flex items-start justify-between gap-1">
              <p class="text-sm font-semibold text-slate-900 dark:text-white" :style="headingStyle">{{ item.title }}</p>
              <span v-if="item.badge && layout.showCategoryBadge" class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{{ item.badge }}</span>
            </div>
            <p v-if="item.price !== null" class="text-sm font-semibold" :style="{ color: primaryColor }">{{ priceFormatter.format(item.price) }}</p>
          </div>
        </article>
      </div>
    </template>

    <!-- MOSAIC -->
    <template v-else-if="layout.itemLayout === 'mosaic'">
      <div class="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3 dark:bg-slate-800">
        <template v-for="(item, idx) in props.items" :key="item.id">
          <div
            v-if="idx === 0"
            :ref="(el: any) => setItemRef(el as HTMLElement | null, idx)"
            :style="getItemStyle(itemRefs[idx] ?? null, idx)"
            class="group relative col-span-2 overflow-hidden bg-slate-100 sm:col-span-2 lg:col-span-2 dark:bg-slate-900"
          >
            <div class="aspect-[3/2] sm:aspect-[2/1]">
              <img :src="getItemImage(item)" :alt="item.title" class="h-full w-full cursor-pointer object-cover transition-transform duration-700 group-hover:scale-105" @click="emit('open-gallery', getGalleryIndex(item.id))" />
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-400 group-hover:opacity-100" />
            <div class="absolute bottom-0 left-0 right-0 translate-y-2 px-5 py-4 opacity-0 transition-all duration-400 group-hover:translate-y-0 group-hover:opacity-100">
              <p class="text-lg font-semibold text-white" :style="headingStyle">{{ item.title }}</p>
              <p v-if="item.price !== null" class="mt-1 text-sm font-medium text-white/90">{{ priceFormatter.format(item.price) }}</p>
            </div>
            <div class="absolute left-4 top-4">
              <span v-if="item.badge && layout.showCategoryBadge" class="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-900 backdrop-blur-sm">{{ item.badge }}</span>
            </div>
          </div>
          <div
            v-else
            :ref="(el: any) => setItemRef(el as HTMLElement | null, idx)"
            :style="getItemStyle(itemRefs[idx] ?? null, idx)"
            class="group relative overflow-hidden bg-slate-100 dark:bg-slate-900"
          >
            <div class="aspect-[4/3]">
              <img :src="getItemImage(item)" :alt="item.title" class="h-full w-full cursor-pointer object-cover transition-transform duration-500 group-hover:scale-105" @click="emit('open-gallery', getGalleryIndex(item.id))" />
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-400 group-hover:opacity-100" />
            <div class="absolute bottom-0 left-0 right-0 translate-y-2 px-4 py-3 opacity-0 transition-all duration-400 group-hover:translate-y-0 group-hover:opacity-100">
              <p class="text-sm font-semibold text-white" :style="headingStyle">{{ item.title }}</p>
              <p v-if="item.price !== null" class="text-xs font-medium text-white/80">{{ priceFormatter.format(item.price) }}</p>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- SHOWCASE -->
    <template v-else-if="layout.itemLayout === 'showcase'">
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <template v-for="(item, idx) in props.items" :key="item.id">
          <article
            v-if="idx === 0"
            :ref="(el: any) => setItemRef(el as HTMLElement | null, idx)"
            :style="getItemStyle(itemRefs[idx] ?? null, idx)"
            :class="[
              'overflow-hidden border border-slate-200 bg-white transition-all duration-300 sm:col-span-2 lg:col-span-2 dark:border-slate-800 dark:bg-slate-950',
              layout.cardRounded,
              layout.cardShadow,
              layout.cardHover,
            ]"
          >
            <div class="flex flex-col sm:flex-row">
              <div class="sm:w-1/2">
                <div class="aspect-[4/3] overflow-hidden bg-slate-100 sm:h-full dark:bg-slate-900">
                  <img :src="getItemImage(item)" :alt="item.title" class="h-full w-full cursor-pointer object-cover transition-transform duration-500 hover:scale-105" @click="emit('open-gallery', getGalleryIndex(item.id))" />
                </div>
              </div>
              <div class="flex flex-1 flex-col justify-center gap-3 p-6">
                <div>
                  <UBadge v-if="item.badge && layout.showCategoryBadge" color="neutral" variant="soft" class="mb-2">{{ item.badge }}</UBadge>
                  <p class="text-xl font-semibold text-slate-900 dark:text-white" :style="headingStyle">{{ item.title }}</p>
                  <p v-if="item.subtitle" class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ item.subtitle }}</p>
                </div>
                <p v-if="item.description" class="text-sm leading-6 text-slate-600 dark:text-slate-300">{{ item.description }}</p>
                <div class="flex items-center justify-between gap-3 pt-2">
                  <p class="text-sm text-slate-500 dark:text-slate-400">{{ item.meta || "Disponible" }}</p>
                  <p v-if="item.price !== null" class="text-lg font-semibold transition-colors duration-300" :style="{ color: primaryColor }">
                    {{ priceFormatter.format(item.price) }}
                  </p>
                </div>
              </div>
            </div>
          </article>
          <article
            v-else
            :ref="(el: any) => setItemRef(el as HTMLElement | null, idx)"
            :style="getItemStyle(itemRefs[idx] ?? null, idx)"
            :class="[
              'overflow-hidden border border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-950',
              layout.cardRounded,
              layout.cardShadow,
              layout.cardHover,
            ]"
          >
            <div class="aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-900">
              <img :src="getItemImage(item)" :alt="item.title" class="h-full w-full cursor-pointer object-cover transition-transform duration-500 hover:scale-105" @click="emit('open-gallery', getGalleryIndex(item.id))" />
            </div>
            <div class="space-y-2 p-4">
              <div class="flex items-start justify-between gap-2">
                <p class="text-base font-semibold text-slate-900 dark:text-white" :style="headingStyle">{{ item.title }}</p>
                <UBadge v-if="item.badge && layout.showCategoryBadge" color="neutral" variant="soft">{{ item.badge }}</UBadge>
              </div>
              <p v-if="item.price !== null" class="text-sm font-semibold" :style="{ color: primaryColor }">{{ priceFormatter.format(item.price) }}</p>
            </div>
          </article>
        </template>
      </div>
    </template>

    <!-- TABLE -->
    <template v-else-if="layout.itemLayout === 'table'">
      <div :class="['overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950', layout.cardRounded]">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <th class="px-4 py-3 sm:px-5">Item</th>
              <th class="hidden px-4 py-3 sm:table-cell sm:px-5">Detalle</th>
              <th class="px-4 py-3 text-right sm:px-5">Precio</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, idx) in props.items"
              :key="item.id"
              :ref="(el: any) => setItemRef(el as HTMLElement | null, idx)"
              :style="getItemStyle(itemRefs[idx] ?? null, idx)"
              class="border-b border-slate-100 transition-colors duration-200 hover:bg-slate-50 last:border-b-0 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              <td class="px-4 py-3 sm:px-5">
                <div class="flex items-center gap-3">
                  <div class="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                    <img :src="getItemImage(item)" :alt="item.title" class="h-full w-full cursor-pointer object-cover transition-transform hover:scale-110" @click="emit('open-gallery', getGalleryIndex(item.id))" />
                  </div>
                  <div>
                    <p class="font-medium text-slate-900 dark:text-white" :style="headingStyle">{{ item.title }}</p>
                    <p v-if="item.badge" class="text-[11px] text-slate-500 dark:text-slate-400">{{ item.badge }}</p>
                  </div>
                </div>
              </td>
              <td class="hidden px-4 py-3 text-slate-600 sm:table-cell sm:px-5 dark:text-slate-300">
                <p class="text-sm">{{ item.subtitle || item.meta || "-" }}</p>
                <p v-if="item.description" class="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{{ item.description }}</p>
              </td>
              <td class="px-4 py-3 text-right sm:px-5">
                <p v-if="item.price !== null" class="font-semibold" :style="{ color: primaryColor }">{{ priceFormatter.format(item.price) }}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- CAROUSEL -->
    <template v-else-if="layout.itemLayout === 'carousel'">
      <div class="group/carousel relative">
        <button
          v-if="canScrollLeft"
          class="absolute -left-3 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-slate-200 transition-all hover:scale-110 hover:shadow-lg group-hover/carousel:flex dark:bg-slate-900 dark:ring-slate-700"
          @click="scrollCarousel('left')"
        >
          <UIcon name="i-lucide-chevron-left" class="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </button>
        <button
          v-if="canScrollRight"
          class="absolute -right-3 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-slate-200 transition-all hover:scale-110 hover:shadow-lg group-hover/carousel:flex dark:bg-slate-900 dark:ring-slate-700"
          @click="scrollCarousel('right')"
        >
          <UIcon name="i-lucide-chevron-right" class="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </button>
        <div
          ref="carouselRef"
          class="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 scroll-smooth"
          @scroll="updateCarouselButtons"
        >
          <article
            v-for="(item, idx) in props.items"
            :key="item.id"
            :ref="(el: any) => setItemRef(el as HTMLElement | null, idx)"
            :style="getItemStyle(itemRefs[idx] ?? null, idx)"
            :class="[
              'w-72 shrink-0 snap-start overflow-hidden border border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-950',
              layout.cardRounded,
              layout.cardShadow,
              layout.cardHover,
            ]"
          >
            <div class="aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-900">
              <img :src="getItemImage(item)" :alt="item.title" class="h-full w-full cursor-pointer object-cover transition-transform duration-500 hover:scale-105" @click="emit('open-gallery', getGalleryIndex(item.id))" />
            </div>
            <div class="space-y-2 p-4">
              <div class="flex items-start justify-between gap-2">
                <p class="text-base font-semibold text-slate-900 dark:text-white" :style="headingStyle">{{ item.title }}</p>
                <UBadge v-if="item.badge && layout.showCategoryBadge" color="neutral" variant="soft">{{ item.badge }}</UBadge>
              </div>
              <p v-if="item.subtitle" class="text-xs text-slate-500 dark:text-slate-400">{{ item.subtitle }}</p>
              <div class="flex items-center justify-between gap-3 pt-1">
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ item.meta || "Disponible" }}</p>
                <p v-if="item.price !== null" class="text-sm font-semibold transition-colors duration-300" :style="{ color: primaryColor }">
                  {{ priceFormatter.format(item.price) }}
                </p>
              </div>
            </div>
          </article>
        </div>
        <div v-if="props.items.length > 1" class="mt-3 flex justify-center gap-1.5">
          <button
            v-for="(_, idx) in items"
            :key="idx"
            class="h-1.5 rounded-full transition-all duration-300"
            :class="idx === 0 ? 'w-4 opacity-100' : 'w-1.5 opacity-40 hover:opacity-70'"
            :style="{ backgroundColor: primaryColor }"
            @click="
              carouselRef?.children[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
            "
          />
        </div>
      </div>
    </template>
  </div>

  <div v-else class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 py-16 text-center backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/30">
    <UIcon name="i-lucide-package-open" class="h-12 w-12 text-slate-300 dark:text-slate-600" />
    <p class="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
      Sin {{ props.storefront.template.businessType === "lodging" ? "habitaciones" : props.storefront.template.businessType === "service" ? "servicios" : "productos" }} disponibles
    </p>
    <p class="mt-1 text-xs text-slate-400">Agrega items desde el panel de administracion.</p>
  </div>
</template>
