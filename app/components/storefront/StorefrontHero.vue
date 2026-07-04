<script setup lang="ts">
import type { PublicStorefrontResponse } from "@/types/storefront";

const props = defineProps<{
  storefront: PublicStorefrontResponse;
  layout: {
    heroRounded: string;
    heroPadding: string;
    heroDecoration: "none" | "pattern" | "glass" | "avatar";
    heroLayout: "left" | "centered" | "split";
    heroGradient: string;
    heroTitleSize: string;
    heroSubtitleSize: string;
    heroCentered: boolean;
  };
  headingStyle: Record<string, string>;
  whatsappUrl: string | null;
  instagramUrl: string | null;
  currencyCode: string;
  template: { eyebrow: string; label: string; heroTitle: string; heroSubtitle: string; design: { defaultHeroImage?: string } };
  companyDescription: string | null;
  sectionTitle: string;
}>();

const heroBg = computed(() => {
  const customImage = props.storefront.settings.heroImageUrl;
  const defaultImage = props.template.design.defaultHeroImage;
  const imageUrl = customImage || defaultImage || null;
  const gradient = `linear-gradient(${props.layout.heroGradient}, ${props.storefront.settings.primaryColor}cc 0%, ${props.storefront.settings.accentColor}cc 100%)`;

  if (!imageUrl) {
    return {
      background: `linear-gradient(${props.layout.heroGradient}, ${props.storefront.settings.primaryColor} 0%, ${props.storefront.settings.accentColor} 100%)`,
    };
  }

  return {
    background: `${gradient}, url(${imageUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
});

const { observe: observeHero } = useScrollReveal({ delay: 100, animation: "fade-up" });
const heroRef = ref<HTMLElement | null>(null);

const scrollY = ref(0);

const handleScroll = () => {
  scrollY.value = window.scrollY;
};

const { getParallaxStyle } = useScrollReveal();

onMounted(() => {
  if (heroRef.value) {
    observeHero(heroRef.value);
  }
  window.addEventListener("scroll", handleScroll, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", handleScroll);
});

const heroDecorationSvg = computed(() => {
  const k = props.storefront.template.key;
  switch (k) {
    case "product-grocery":
      return `
        <svg class="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs><pattern id="grocery-grid" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="white"/></pattern></defs>
          <rect width="100" height="100" fill="url(#grocery-grid)"/>
        </svg>
        <div class="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/[0.07] blur-3xl"/>
        <div class="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/[0.05] blur-2xl"/>`;
    case "product-fashion":
      return `
        <svg class="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs><pattern id="fashion-lines" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="40" stroke="white" stroke-width="0.5"/></pattern></defs>
          <rect width="100" height="100" fill="url(#fashion-lines)"/>
        </svg>
        <div class="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/[0.06] blur-3xl"/>`;
    case "service-salon":
      return `
        <div class="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full border border-white/[0.1]"/>
        <div class="pointer-events-none absolute -bottom-4 left-1/3 h-24 w-24 rounded-full border border-white/[0.07]"/>
        <div class="pointer-events-none absolute right-1/4 top-1/2 h-16 w-16 rounded-full bg-white/[0.04] blur-xl"/>`;
    case "lodging-hotel":
      return `
        <div class="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.04] blur-3xl"/>
        <div class="pointer-events-none absolute -left-16 top-1/4 h-48 w-48 rounded-full bg-white/[0.03] blur-3xl"/>
        <div class="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent"/>`;
    default:
      return `
        <div class="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/[0.06] blur-3xl"/>
        <div class="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/[0.04] blur-2xl"/>`;
  }
});

const handeScrollToItems = () => {
  const el = document.querySelector("[data-storefront-items]");
  el?.scrollIntoView({ behavior: "smooth" });
};
</script>

<template>
  <div
    ref="heroRef"
    :style="[heroBg, getParallaxStyle(scrollY, 0.08)]"
    :class="[layout.heroRounded, layout.heroPadding]"
    class="relative overflow-hidden text-white shadow-sm transition-all duration-700"
    role="banner"
  >
    <div v-html="heroDecorationSvg" />

    <!-- LEFT layout -->
    <template v-if="layout.heroLayout === 'left'">
      <div class="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div class="max-w-3xl">
          <p class="text-xs uppercase tracking-[0.26em] text-white/70">{{ template.eyebrow }}</p>
          <div class="mt-4 flex items-center gap-4">
            <img
              v-if="storefront.organization.logoUrl"
              :src="storefront.organization.logoUrl"
              alt="Logo"
              class="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/20"
            />
            <div v-else-if="layout.heroDecoration === 'avatar'" class="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold text-white ring-1 ring-white/30">
              {{ storefront.organization.name.charAt(0).toUpperCase() }}
            </div>
            <div>
              <h1 class="font-semibold" :class="layout.heroTitleSize" :style="headingStyle">
                {{ storefront.organization.name }}
              </h1>
              <p class="mt-1 text-sm text-white/80">{{ template.label }}</p>
            </div>
          </div>
          <p class="mt-5 font-medium" :class="layout.heroSubtitleSize" :style="headingStyle">{{ template.heroTitle }}</p>
          <p class="mt-3 max-w-2xl leading-7 text-white/85" :class="layout.heroSubtitleSize">
            {{ companyDescription || template.heroSubtitle }}
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
              <UButton
            v-if="whatsappUrl"
            :to="whatsappUrl"
            target="_blank"
            color="neutral"
            variant="solid"
            icon="i-lucide-message-circle"
            size="lg"
            class="ripple !bg-white/20 !text-white !ring-1 !ring-white/30 transition-all duration-300 hover:!bg-white/30 hover:!scale-105"
          >
            Contactar
          </UButton>
          <UButton
            v-if="instagramUrl"
            :to="instagramUrl"
            target="_blank"
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-lucide-instagram"
            class="ripple !border-white/30 !text-white transition-all duration-300 hover:!bg-white/10 hover:!scale-105"
          >
            Instagram
          </UButton>
        </div>
      </div>
      <div class="relative z-10 mt-6 flex flex-wrap gap-4 border-t border-white/10 pt-4">
        <div
          v-for="detail in [
            { icon: 'i-lucide-store', label: 'Tipo', value: template.label },
            { icon: 'i-lucide-currency-dollar', label: 'Moneda', value: currencyCode },
            storefront.organization.country ? { icon: 'i-lucide-map-pin', label: 'Pais', value: storefront.organization.country } : null,
          ].filter(Boolean)"
          :key="detail!.label"
          class="flex items-center gap-2"
        >
          <UIcon :name="detail!.icon" class="h-3.5 w-3.5 text-white/50" />
          <div>
            <p class="text-[10px] uppercase tracking-[0.15em] text-white/50">{{ detail!.label }}</p>
            <p class="text-sm font-medium text-white">{{ detail!.value }}</p>
          </div>
        </div>
      </div>
    </template>

    <!-- CENTERED layout -->
    <template v-else-if="layout.heroLayout === 'centered'">
      <div class="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
        <p class="text-xs uppercase tracking-[0.26em] text-white/70">{{ template.eyebrow }}</p>
        <div class="mt-5 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <img
            v-if="storefront.organization.logoUrl"
            :src="storefront.organization.logoUrl"
            alt="Logo"
            class="h-20 w-20 rounded-2xl object-cover ring-2 ring-white/20 sm:h-24 sm:w-24"
          />
          <div v-else class="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 text-3xl font-bold text-white ring-2 ring-white/30 sm:h-24 sm:w-24 sm:text-4xl">
            {{ storefront.organization.name.charAt(0).toUpperCase() }}
          </div>
          <div>
            <h1 class="font-semibold" :class="layout.heroTitleSize" :style="headingStyle">
              {{ storefront.organization.name }}
            </h1>
            <p class="mt-1 text-sm text-white/80">{{ template.label }}</p>
          </div>
        </div>
        <p class="mt-6 font-medium leading-relaxed" :class="layout.heroSubtitleSize" :style="headingStyle">{{ template.heroTitle }}</p>
        <p class="mt-3 max-w-2xl leading-7 text-white/85" :class="layout.heroSubtitleSize">
          {{ companyDescription || template.heroSubtitle }}
        </p>
        <div class="mt-6 flex flex-wrap justify-center gap-3">
          <UButton
            v-if="whatsappUrl"
            :to="whatsappUrl"
            target="_blank"
            color="neutral"
            variant="solid"
            icon="i-lucide-message-circle"
            size="lg"
            class="ripple !bg-white/20 !text-white !ring-1 !ring-white/30 transition-all duration-300 hover:!bg-white/30 hover:!scale-105"
          >
            Contactar
          </UButton>
          <UButton
            v-if="instagramUrl"
            :to="instagramUrl"
            target="_blank"
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-lucide-instagram"
            class="ripple !border-white/30 !text-white transition-all duration-300 hover:!bg-white/10 hover:!scale-105"
          >
            Instagram
          </UButton>
        </div>
      </div>
      <div class="relative z-10 mt-8 flex flex-wrap justify-center gap-6 border-t border-white/10 pt-5">
        <div
          v-for="detail in [
            { icon: 'i-lucide-store', label: 'Tipo', value: template.label },
            { icon: 'i-lucide-currency-dollar', label: 'Moneda', value: currencyCode },
            storefront.organization.country ? { icon: 'i-lucide-map-pin', label: 'Pais', value: storefront.organization.country } : null,
          ].filter(Boolean)"
          :key="detail!.label"
          class="flex items-center gap-2"
        >
          <UIcon :name="detail!.icon" class="h-3.5 w-3.5 text-white/50" />
          <div class="text-left">
            <p class="text-[10px] uppercase tracking-[0.15em] text-white/50">{{ detail!.label }}</p>
            <p class="text-sm font-medium text-white">{{ detail!.value }}</p>
          </div>
        </div>
      </div>
    </template>

    <!-- SPLIT layout -->
    <template v-else-if="layout.heroLayout === 'split'">
      <div class="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center">
        <div class="max-w-xl lg:w-1/2">
          <p class="text-xs uppercase tracking-[0.26em] text-white/70">{{ template.eyebrow }}</p>
          <h1 class="mt-4 font-semibold" :class="layout.heroTitleSize" :style="headingStyle">
            {{ storefront.organization.name }}
          </h1>
          <p class="mt-1 text-sm text-white/80">{{ template.label }}</p>
          <p class="mt-5 font-medium leading-relaxed" :class="layout.heroSubtitleSize" :style="headingStyle">{{ template.heroTitle }}</p>
          <p class="mt-3 leading-7 text-white/85" :class="layout.heroSubtitleSize">
            {{ companyDescription || template.heroSubtitle }}
          </p>
          <div class="mt-6 flex flex-wrap gap-3">
            <UButton
              v-if="whatsappUrl"
              :to="whatsappUrl"
              target="_blank"
              color="neutral"
              variant="solid"
              icon="i-lucide-message-circle"
              size="lg"
              class="ripple !bg-white/20 !text-white !ring-1 !ring-white/30 transition-all duration-300 hover:!bg-white/30 hover:!scale-105"
            >
              Contactar
            </UButton>
            <UButton
              v-if="instagramUrl"
              :to="instagramUrl"
              target="_blank"
              color="neutral"
              variant="outline"
              size="lg"
              icon="i-lucide-instagram"
              class="ripple !border-white/30 !text-white transition-all duration-300 hover:!bg-white/10 hover:!scale-105"
            >
              Instagram
            </UButton>
          </div>
        </div>
        <div class="flex items-center justify-center lg:w-1/2">
          <img
            v-if="storefront.organization.logoUrl"
            :src="storefront.organization.logoUrl"
            :alt="storefront.organization.name"
            class="h-32 w-32 rounded-3xl object-cover ring-4 ring-white/20 shadow-2xl sm:h-40 sm:w-40 lg:h-48 lg:w-48"
          />
          <div
            v-else
            class="flex h-32 w-32 items-center justify-center rounded-3xl bg-white/15 text-5xl font-bold text-white ring-4 ring-white/20 backdrop-blur-sm sm:h-40 sm:w-40 sm:text-6xl lg:h-48 lg:w-48 lg:text-7xl"
          >
            {{ storefront.organization.name.charAt(0).toUpperCase() }}
          </div>
        </div>
      </div>
      <div class="relative z-10 mt-8 flex flex-wrap gap-6 border-t border-white/10 pt-5">
        <div
          v-for="detail in [
            { icon: 'i-lucide-store', label: 'Tipo', value: template.label },
            { icon: 'i-lucide-currency-dollar', label: 'Moneda', value: currencyCode },
            storefront.organization.country ? { icon: 'i-lucide-map-pin', label: 'Pais', value: storefront.organization.country } : null,
          ].filter(Boolean)"
          :key="detail!.label"
          class="flex items-center gap-2"
        >
          <UIcon :name="detail!.icon" class="h-3.5 w-3.5 text-white/50" />
          <div>
            <p class="text-[10px] uppercase tracking-[0.15em] text-white/50">{{ detail!.label }}</p>
            <p class="text-sm font-medium text-white">{{ detail!.value }}</p>
          </div>
        </div>
      </div>
    </template>
  </div>

  <button
    class="ripple mx-auto mt-4 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] transition-opacity hover:opacity-70"
    :style="{ color: storefront.settings.primaryColor }"
    @click="handeScrollToItems"
  >
    Ver {{ sectionTitle.toLowerCase() }}
    <UIcon name="i-lucide-chevron-down" class="h-3.5 w-3.5 animate-bounce" />
  </button>
</template>
