<script setup lang="ts">
import { getStorefrontTemplate } from "@/utils/storefront";

import type { StorefrontColorPresetKey, StorefrontItemLayout, StorefrontTemplateKey } from "@/types/storefront";

interface Props {
  templateKey: StorefrontTemplateKey;
  colorPresetKey: StorefrontColorPresetKey;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  companyDescription: string | null;
  organizationName?: string;
}

const props = withDefaults(defineProps<Props>(), {
  organizationName: "Mi Negocio",
  companyDescription: null,
});

const template = computed(() => getStorefrontTemplate(props.templateKey));
const design = computed(() => template.value.design);

const heroStyle = computed(() => ({
  background: `linear-gradient(135deg, ${props.primaryColor} 0%, ${props.accentColor} 100%)`,
}));

const pageStyle = computed(() => ({
  backgroundColor: props.secondaryColor,
  fontFamily: design.value.bodyFont,
}));

const headingStyle = computed(() => ({
  fontFamily: design.value.headingFont,
}));

const sampleItems = [
  { title: "Producto A", price: 25.0, badge: "Producto", image: false },
  { title: "Producto B", price: 45.5, badge: "Producto", image: false },
  { title: "Producto C", price: 12.0, badge: "Producto", image: false },
];

const itemLayout = computed<StorefrontItemLayout>(() => {
  const k = template.value.key;
  if (k === "product-fashion") return "mosaic";
  if (k === "product-parts") return "table";
  if (k === "service-salon" || k === "lodging-cabin") return "showcase";
  if (k === "service-clinic" || k === "service-technical") return "list-row";
  if (k === "lodging-hotel") return "carousel";
  return "card-grid";
});

const heroRounded = computed(() => {
  const k = template.value.key;
  if (k === "product-fashion") return "rounded-none";
  if (k === "service-salon") return "rounded-[1.25rem]";
  if (k === "lodging-hotel" || k === "product-parts") return "rounded-lg";
  return "rounded-xl";
});
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-700">
    <div class="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2 dark:border-slate-700 dark:bg-slate-900">
      <div class="flex items-center gap-2">
        <span class="h-3 w-3 rounded-full bg-red-400" />
        <span class="h-3 w-3 rounded-full bg-yellow-400" />
        <span class="h-3 w-3 rounded-full bg-green-400" />
      </div>
      <span class="text-[10px] text-slate-400">Vista previa en vivo</span>
    </div>

    <div class="flex flex-col transition-all duration-300" :style="pageStyle">
      <div class="flex items-center justify-between border-b px-4 py-2.5" :style="{ borderColor: `${props.primaryColor}20` }">
        <div class="flex items-center gap-2">
          <div
            class="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white"
            :style="{ backgroundColor: props.primaryColor }"
          >
            {{ organizationName.charAt(0).toUpperCase() }}
          </div>
          <p class="text-[11px] font-semibold text-slate-900 dark:text-white">{{ organizationName }}</p>
        </div>
        <div class="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-white" :style="{ backgroundColor: props.primaryColor }">
          <UIcon name="i-lucide-user" class="h-3 w-3" />
          Ingresar
        </div>
      </div>

      <div class="space-y-3 p-4">
        <div
          class="relative overflow-hidden p-4 text-white shadow-sm"
          :class="heroRounded"
          :style="heroStyle"
        >
          <div class="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/10 blur-xl" />
          <p class="relative z-10 text-[10px] uppercase tracking-[0.2em] text-white/70">{{ template.eyebrow }}</p>
          <div class="relative z-10 mt-2 flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-sm font-bold text-white">
              {{ organizationName.charAt(0).toUpperCase() }}
            </div>
            <div>
              <p class="text-sm font-semibold text-white" :style="headingStyle">{{ organizationName }}</p>
              <p class="text-[10px] text-white/70">{{ template.label }}</p>
            </div>
          </div>
          <p class="relative z-10 mt-2 text-xs font-medium text-white" :style="headingStyle">{{ template.heroTitle }}</p>
          <p class="relative z-10 mt-1 text-[10px] leading-5 text-white/80">
            {{ companyDescription || template.heroSubtitle }}
          </p>
        </div>

        <template v-if="itemLayout === 'card-grid'">
          <div class="grid grid-cols-3 gap-2">
            <div v-for="item in sampleItems" :key="item.title" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition-all duration-200 dark:border-slate-700 dark:bg-slate-950">
              <div class="aspect-[4/3] bg-slate-100 dark:bg-slate-800" />
              <div class="space-y-1 p-2">
                <div class="flex items-start justify-between gap-1">
                  <p class="text-[11px] font-semibold text-slate-900 dark:text-white" :style="headingStyle">{{ item.title }}</p>
                  <span class="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{{ item.badge }}</span>
                </div>
                <p class="text-[10px] font-semibold" :style="{ color: props.primaryColor }">Bs {{ item.price.toFixed(2) }}</p>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="itemLayout === 'list-row'">
          <div class="space-y-2">
            <div v-for="item in sampleItems" :key="item.title" class="flex gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white transition-all dark:border-slate-700 dark:bg-slate-950">
              <div class="h-16 w-16 shrink-0 bg-slate-100 dark:bg-slate-800" />
              <div class="flex flex-1 flex-col justify-center gap-0.5 py-2 pr-3">
                <div class="flex items-start justify-between gap-1">
                  <p class="text-[11px] font-semibold text-slate-900 dark:text-white" :style="headingStyle">{{ item.title }}</p>
                  <span class="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{{ item.badge }}</span>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <p class="text-[9px] text-slate-500">Disponible</p>
                  <p class="text-[10px] font-semibold" :style="{ color: props.primaryColor }">Bs {{ item.price.toFixed(2) }}</p>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="itemLayout === 'mosaic'">
          <div class="grid gap-px bg-slate-200 dark:bg-slate-700">
            <div v-for="(item, idx) in sampleItems" :key="item.title" :class="idx === 0 ? 'col-span-2' : ''" class="group relative overflow-hidden bg-slate-100 dark:bg-slate-800">
              <div :class="idx === 0 ? 'aspect-[2/1]' : 'aspect-[4/3]'" class="bg-slate-100 dark:bg-slate-800" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div class="absolute bottom-0 left-0 right-0 px-3 py-2">
                <p class="text-[10px] font-semibold text-white" :style="headingStyle">{{ item.title }}</p>
                <p class="text-[8px] font-medium text-white/80">Bs {{ item.price.toFixed(2) }}</p>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="itemLayout === 'showcase'">
          <div class="grid gap-2 sm:grid-cols-2">
            <div v-for="(item, idx) in sampleItems" :key="item.title" :class="idx === 0 ? 'sm:col-span-2' : ''" class="flex overflow-hidden rounded-xl border border-slate-200 bg-white transition-all dark:border-slate-700 dark:bg-slate-950">
              <div v-if="idx === 0" class="flex w-full">
                <div class="w-1/2 bg-slate-100 dark:bg-slate-800" />
                <div class="flex w-1/2 flex-col justify-center gap-1 p-3">
                  <span class="w-fit rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{{ item.badge }}</span>
                  <p class="text-[11px] font-semibold text-slate-900 dark:text-white" :style="headingStyle">{{ item.title }}</p>
                  <p class="text-[9px] font-semibold" :style="{ color: props.primaryColor }">Bs {{ item.price.toFixed(2) }}</p>
                </div>
              </div>
              <div v-else class="flex w-full flex-col">
                <div class="aspect-[4/3] bg-slate-100 dark:bg-slate-800" />
                <div class="flex items-center justify-between gap-1 p-2">
                  <p class="text-[10px] font-semibold text-slate-900 dark:text-white" :style="headingStyle">{{ item.title }}</p>
                  <p class="text-[9px] font-semibold" :style="{ color: props.primaryColor }">Bs {{ item.price.toFixed(2) }}</p>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="itemLayout === 'table'">
          <div class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
            <table class="w-full text-left text-[10px]">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50 text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  <th class="px-3 py-2">Item</th>
                  <th class="px-3 py-2 text-right">Precio</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in sampleItems" :key="item.title" class="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                  <td class="px-3 py-2">
                    <div class="flex items-center gap-2">
                      <div class="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800" />
                      <p class="font-medium text-slate-900 dark:text-white" :style="headingStyle">{{ item.title }}</p>
                    </div>
                  </td>
                  <td class="px-3 py-2 text-right font-semibold" :style="{ color: props.primaryColor }">Bs {{ item.price.toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-else-if="itemLayout === 'carousel'">
          <div class="flex gap-2 overflow-x-auto pb-1">
            <div v-for="item in sampleItems" :key="item.title" class="w-36 shrink-0 snap-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-950">
              <div class="aspect-[4/3] bg-slate-100 dark:bg-slate-800" />
              <div class="space-y-1 p-2">
                <p class="text-[10px] font-semibold text-slate-900 dark:text-white" :style="headingStyle">{{ item.title }}</p>
                <div class="flex items-center justify-between gap-1">
                  <p class="text-[8px] text-slate-500">Disponible</p>
                  <p class="text-[9px] font-semibold" :style="{ color: props.primaryColor }">Bs {{ item.price.toFixed(2) }}</p>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-1 flex justify-center gap-1">
            <span v-for="i in 3" :key="i" class="h-1 rounded-full transition-all" :class="i === 1 ? 'w-3 opacity-100' : 'w-1 opacity-30'" :style="{ backgroundColor: props.primaryColor }" />
          </div>
        </template>
      </div>

      <div class="border-t px-4 py-3 text-center" :style="{ borderColor: `${props.primaryColor}20` }">
        <p class="text-[9px] text-slate-400">{{ organizationName }} &middot; Tienda virtual</p>
        <p class="mt-1 text-[8px] text-slate-400">&copy; 2026 NexusPOS. Todos los derechos reservados.</p>
      </div>
    </div>
  </div>
</template>
