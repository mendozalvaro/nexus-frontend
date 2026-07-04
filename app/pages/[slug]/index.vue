<script setup lang="ts">
import PublicBarbershopStorefront from "@/components/storefront/PublicBarbershopStorefront.vue";
import PublicTenantStorefront from "@/components/storefront/PublicTenantStorefront.vue";
import TemplateSkeleton from "@/components/storefront/TemplateSkeleton.vue";
import type { PublicStorefrontResponse } from "@/types/storefront";

definePageMeta({
  layout: false,
  publicStorefront: true,
});

const route = useRoute();
const { loadStorefrontBySlug } = usePublicStorefront();

const slug = computed(() => {
  const value = route.params.slug;
  return typeof value === "string" ? value.trim().toLowerCase() : "";
});

const { data: storefront, pending, error } = await useAsyncData(
  () => `public-storefront-${slug.value}`,
  () => loadStorefrontBySlug(slug.value),
  { watch: [slug] },
);

const currentStorefront = computed<PublicStorefrontResponse | null>(() => storefront.value ?? null);
const isShapaBarber = computed(() => slug.value === "shapa-barber");

const fontHrefs = computed(() => {
  const tpl = currentStorefront.value?.template;
  if (!tpl && !isShapaBarber.value) {
    return [];
  }
  const h = isShapaBarber.value ? "'Bodoni Moda', serif" : tpl?.design.headingFont ?? "";
  const b = isShapaBarber.value ? "'Jost', sans-serif" : tpl?.design.bodyFont ?? "";
  const urls: string[] = [];
  if (h.includes("Rubik") || b.includes("Nunito")) {
    urls.push("https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;500;600;700&family=Rubik:wght@300;400;500;600;700&display=swap");
  }
  if (h.includes("Lora") || b.includes("Raleway")) {
    urls.push("https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Raleway:wght@300;400;500;600;700&display=swap");
  }
  if (h.includes("Figtree") || b.includes("Noto")) {
    urls.push("https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700&family=Noto+Sans:wght@300;400;500;700&display=swap");
  }
  if (h.includes("Fira Code") || b.includes("Fira Sans")) {
    urls.push("https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap");
  }
  if (h.includes("Inter")) {
    urls.push("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap");
  }
  if (h.includes("DM Sans")) {
    urls.push("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap");
  }
  if (h.includes("Playfair")) {
    urls.push("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap");
  }
  if (h.includes("Bodoni")) {
    urls.push("https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@400;500;600;700&family=Jost:wght@300;400;500;600;700&display=swap");
  }
  return [...new Set(urls)];
});

useHead({
  link: computed(() => fontHrefs.value.map((href) => ({ rel: "stylesheet", href }))),
});

useSeoMeta({
  title: () => currentStorefront.value ? `${currentStorefront.value.organization.name} | Tienda virtual` : "Tienda virtual",
  description: () => currentStorefront.value?.settings.companyDescription ?? currentStorefront.value?.template.heroSubtitle ?? "Storefront publico por tenant.",
  ogTitle: () => currentStorefront.value ? `${currentStorefront.value.organization.name} | Tienda virtual` : "Tienda virtual",
  ogDescription: () => currentStorefront.value?.template.heroSubtitle ?? "Storefront publico por tenant.",
});
</script>

<template>
  <div>
    <TemplateSkeleton v-if="pending" :template-key="currentStorefront?.template?.key" />

    <div v-else-if="error || !currentStorefront" class="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section class="max-w-lg rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <p class="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Tienda virtual</p>
        <h1 class="mt-3 text-4xl font-semibold text-slate-900 dark:text-white">Tienda no disponible</h1>
        <p class="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          No pudimos cargar esta tienda. Verifica el slug o publica el storefront desde Settings.
        </p>
      </section>
    </div>

    <PublicBarbershopStorefront
      v-else-if="isShapaBarber && currentStorefront"
      :storefront="currentStorefront"
      :slug="slug"
    />

    <PublicTenantStorefront v-else :storefront="currentStorefront" :slug="slug" />
  </div>
</template>
