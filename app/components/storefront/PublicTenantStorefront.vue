<script setup lang="ts">
import StorefrontHead from "@/components/storefront/StorefrontHead.vue";
import StorefrontHero from "@/components/storefront/StorefrontHero.vue";
import StorefrontCategories from "@/components/storefront/StorefrontCategories.vue";
import StorefrontItemsGrid from "@/components/storefront/StorefrontItemsGrid.vue";
import StorefrontGallery from "@/components/storefront/StorefrontGallery.vue";
import StorefrontWhatsAppFloat from "@/components/storefront/StorefrontWhatsAppFloat.vue";
import StorefrontEmptyState from "@/components/storefront/StorefrontEmptyState.vue";
import StorefrontFooter from "@/components/storefront/StorefrontFooter.vue";

import type { PublicStorefrontResponse, StorefrontItemLayout } from "@/types/storefront";

const props = defineProps<{
  storefront: PublicStorefrontResponse;
  slug: string;
}>();

const currencyCode = computed(() => props.storefront.organization.currencyCode ?? "BOB");

const priceFormatter = computed(() => new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: currencyCode.value,
  minimumFractionDigits: 2,
}));

const whatsappPhone = computed(() => props.storefront.organization.whatsapp?.replace(/\D/g, "") ?? "");

const whatsappUrl = computed(() => {
  const phone = whatsappPhone.value;
  if (!phone) return null;
  const message = `Hola ${props.storefront.organization.name}, vi su tienda virtual y quiero recibir informacion.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
});

const instagramUrl = computed(() => {
  const handle = props.storefront.organization.instagram?.replace(/^@+/, "").trim() ?? "";
  return handle ? `https://instagram.com/${handle}` : null;
});

const template = computed(() => props.storefront.template);
const design = computed(() => template.value.design);

const pageStyle = computed(() => ({
  backgroundColor: props.storefront.settings.secondaryColor,
  fontFamily: design.value.bodyFont,
}));

const headingStyle = computed(() => ({
  fontFamily: design.value.headingFont,
}));

const itemBorderStyle = computed(() => ({
  borderColor: `${props.storefront.settings.primaryColor}20`,
}));

const sectionTitle = computed(() => template.value.sectionTitle);

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

const layout = computed<LayoutConfig>(() => {
  const k = template.value.key;
  switch (k) {
    case "product-grocery":
      return {
        heroRounded: "rounded-2xl",
        heroPadding: "p-6 sm:p-8 lg:p-10",
        cardRounded: "rounded-2xl",
        cardShadow: "shadow-md shadow-green-100/20",
        cardHover: "hover:shadow-lg hover:-translate-y-1 hover:border-green-200 dark:hover:border-green-800",
        gridCols: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        gridGap: "gap-4",
        showCategoryBadge: true,
        heroDecoration: "pattern",
        itemLayout: "card-grid",
        heroLayout: "left",
        heroGradient: "135deg",
        heroTitleSize: "text-3xl sm:text-4xl",
        heroSubtitleSize: "text-sm sm:text-base",
        heroCentered: false,
      };
    case "product-fashion":
      return {
        heroRounded: "rounded-none",
        heroPadding: "p-10 sm:p-14 lg:p-16",
        cardRounded: "rounded-sm",
        cardShadow: "shadow-xs",
        cardHover: "hover:shadow-lg hover:scale-[1.02] hover:z-10",
        gridCols: "sm:grid-cols-2 lg:grid-cols-3",
        gridGap: "gap-px bg-slate-200 dark:bg-slate-800 p-px",
        showCategoryBadge: false,
        heroDecoration: "avatar",
        itemLayout: "mosaic",
        heroLayout: "split",
        heroGradient: "180deg",
        heroTitleSize: "text-4xl sm:text-5xl lg:text-6xl",
        heroSubtitleSize: "text-base sm:text-lg",
        heroCentered: true,
      };
    case "product-parts":
      return {
        heroRounded: "rounded-xl",
        heroPadding: "p-5 sm:p-6 lg:p-8",
        cardRounded: "rounded-lg",
        cardShadow: "shadow-xs",
        cardHover: "hover:border-primary-400 hover:shadow-md",
        gridCols: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        gridGap: "gap-3",
        showCategoryBadge: true,
        heroDecoration: "none",
        itemLayout: "table",
        heroLayout: "left",
        heroGradient: "90deg",
        heroTitleSize: "text-2xl sm:text-3xl",
        heroSubtitleSize: "text-sm",
        heroCentered: false,
      };
    case "service-salon":
      return {
        heroRounded: "rounded-[2rem]",
        heroPadding: "p-8 sm:p-10 lg:p-12",
        cardRounded: "rounded-3xl",
        cardShadow: "shadow-lg shadow-pink-100/50 dark:shadow-pink-900/20",
        cardHover: "hover:shadow-xl hover:-translate-y-1.5",
        gridCols: "sm:grid-cols-2",
        gridGap: "gap-6",
        showCategoryBadge: true,
        heroDecoration: "glass",
        itemLayout: "showcase",
        heroLayout: "centered",
        heroGradient: "180deg",
        heroTitleSize: "text-3xl sm:text-4xl lg:text-5xl",
        heroSubtitleSize: "text-sm sm:text-base",
        heroCentered: true,
      };
    case "service-clinic":
      return {
        heroRounded: "rounded-2xl",
        heroPadding: "p-6 sm:p-8 lg:p-10",
        cardRounded: "rounded-2xl",
        cardShadow: "shadow-sm",
        cardHover: "hover:shadow-md hover:border-teal-200 dark:hover:border-teal-800",
        gridCols: "sm:grid-cols-2 lg:grid-cols-3",
        gridGap: "gap-5",
        showCategoryBadge: true,
        heroDecoration: "none",
        itemLayout: "list-row",
        heroLayout: "left",
        heroGradient: "120deg",
        heroTitleSize: "text-3xl sm:text-4xl",
        heroSubtitleSize: "text-sm sm:text-base",
        heroCentered: false,
      };
    case "service-technical":
      return {
        heroRounded: "rounded-xl",
        heroPadding: "p-5 sm:p-6 lg:p-8",
        cardRounded: "rounded-xl",
        cardShadow: "shadow-xs",
        cardHover: "hover:border-primary-500 hover:shadow-sm",
        gridCols: "sm:grid-cols-2 lg:grid-cols-3",
        gridGap: "gap-4",
        showCategoryBadge: true,
        heroDecoration: "none",
        itemLayout: "list-row",
        heroLayout: "left",
        heroGradient: "90deg",
        heroTitleSize: "text-2xl sm:text-3xl",
        heroSubtitleSize: "text-sm",
        heroCentered: false,
      };
    case "lodging-hostal":
      return {
        heroRounded: "rounded-2xl",
        heroPadding: "p-6 sm:p-8 lg:p-10",
        cardRounded: "rounded-2xl",
        cardShadow: "shadow-md",
        cardHover: "hover:shadow-lg hover:-translate-y-0.5",
        gridCols: "sm:grid-cols-2 lg:grid-cols-3",
        gridGap: "gap-5",
        showCategoryBadge: false,
        heroDecoration: "pattern",
        itemLayout: "card-grid",
        heroLayout: "centered",
        heroGradient: "160deg",
        heroTitleSize: "text-3xl sm:text-4xl",
        heroSubtitleSize: "text-sm sm:text-base",
        heroCentered: true,
      };
    case "lodging-hotel":
      return {
        heroRounded: "rounded-2xl",
        heroPadding: "p-8 sm:p-10 lg:p-14",
        cardRounded: "rounded-2xl",
        cardShadow: "shadow-lg shadow-blue-100/50 dark:shadow-blue-900/20",
        cardHover: "hover:shadow-xl hover:-translate-y-1",
        gridCols: "sm:grid-cols-2 lg:grid-cols-3",
        gridGap: "gap-6",
        showCategoryBadge: false,
        heroDecoration: "glass",
        itemLayout: "carousel",
        heroLayout: "split",
        heroGradient: "145deg",
        heroTitleSize: "text-3xl sm:text-4xl lg:text-5xl",
        heroSubtitleSize: "text-sm sm:text-base lg:text-lg",
        heroCentered: true,
      };
    case "lodging-cabin":
      return {
        heroRounded: "rounded-[2.5rem]",
        heroPadding: "p-8 sm:p-10 lg:p-12",
        cardRounded: "rounded-[1.75rem]",
        cardShadow: "shadow-md shadow-emerald-100/30 dark:shadow-emerald-900/20",
        cardHover: "hover:shadow-lg",
        gridCols: "sm:grid-cols-2 lg:grid-cols-3",
        gridGap: "gap-6",
        showCategoryBadge: false,
        heroDecoration: "pattern",
        itemLayout: "showcase",
        heroLayout: "centered",
        heroGradient: "135deg",
        heroTitleSize: "text-3xl sm:text-4xl",
        heroSubtitleSize: "text-sm sm:text-base",
        heroCentered: true,
      };
    default:
      return {
        heroRounded: "rounded-[1.75rem]",
        heroPadding: "p-6 sm:p-8",
        cardRounded: "rounded-[1.75rem]",
        cardShadow: "shadow-sm",
        cardHover: "hover:shadow-md",
        gridCols: "sm:grid-cols-2 xl:grid-cols-3",
        gridGap: "gap-4",
        showCategoryBadge: true,
        heroDecoration: "none",
        itemLayout: "card-grid",
        heroLayout: "left",
        heroGradient: "135deg",
        heroTitleSize: "text-3xl sm:text-4xl",
        heroSubtitleSize: "text-sm sm:text-base",
        heroCentered: false,
      };
  }
});

const activeCategory = ref<string | null>(null);

const filteredItems = computed(() => {
  if (!activeCategory.value) return props.storefront.items;
  return props.storefront.items.filter((item) => item.badge === activeCategory.value);
});

const galleryOpen = ref(false);
const galleryIndex = ref(0);

const galleryItems = computed(() =>
  filteredItems.value
    .filter((item) => item.imageUrl)
    .map((item) => ({ url: item.imageUrl!, title: item.title })),
);

const openGallery = (index: number) => {
  if (index < 0 || !galleryItems.value[index]) return;
  galleryIndex.value = index;
  galleryOpen.value = true;
};
</script>

<template>
  <div class="min-h-screen transition-colors duration-500" :style="pageStyle">
    <StorefrontHead :storefront="storefront" :slug="slug" />

    <section class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <StorefrontHero
        :storefront="storefront"
        :layout="layout"
        :heading-style="headingStyle"
        :whatsapp-url="whatsappUrl"
        :instagram-url="instagramUrl"
        :currency-code="currencyCode"
        :template="template"
        :company-description="storefront.settings.companyDescription"
        :section-title="sectionTitle"
      />

      <div data-storefront-items>
        <div class="mt-6 mb-4 flex items-center justify-between">
          <h2
            class="text-lg font-semibold text-slate-900 dark:text-white"
            :style="headingStyle"
          >
            {{ sectionTitle }}
          </h2>
          <div class="flex items-center gap-3">
            <transition name="count" mode="out-in">
              <span
                :key="filteredItems.length"
                class="text-xs tabular-nums text-slate-500"
              >
                {{ filteredItems.length }}
                {{ filteredItems.length === 1 ? "disponible" : "disponibles" }}
              </span>
            </transition>
          </div>
        </div>

        <StorefrontCategories
          :items="storefront.items"
          :primary-color="storefront.settings.primaryColor"
          :accent-color="storefront.settings.accentColor"
          @change="activeCategory = $event"
        />

        <StorefrontItemsGrid
          v-if="filteredItems.length"
          :storefront="storefront"
          :layout="layout"
          :heading-style="headingStyle"
          :item-border-style="itemBorderStyle"
          :price-formatter="priceFormatter"
          :currency-code="currencyCode"
          :section-title="sectionTitle"
          :items="filteredItems"
          @open-gallery="openGallery"
        />

        <StorefrontEmptyState
          v-else
          :business-type="storefront.settings.businessType"
          :primary-color="storefront.settings.primaryColor"
        />
      </div>

      <StorefrontFooter :storefront="storefront" />
    </section>

    <StorefrontWhatsAppFloat
      :whatsapp-url="whatsappUrl"
      :phone="storefront.organization.phone"
      :primary-color="storefront.settings.primaryColor"
      :items-count="filteredItems.length"
      :section-title="sectionTitle"
    />

    <StorefrontGallery
      :items="galleryItems"
      :open="galleryOpen"
      :initial-index="galleryIndex"
      @close="galleryOpen = false"
    />
  </div>
</template>

<style scoped>
.count-enter-active,
.count-leave-active {
  transition: all 0.2s ease-out;
}
.count-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.9);
}
.count-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.9);
}
</style>
