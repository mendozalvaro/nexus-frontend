<script setup lang="ts">
import { getStorefrontTemplate } from "@/utils/storefront";

import type { StorefrontTemplateKey } from "@/types/storefront";

interface Props {
  templateKey?: StorefrontTemplateKey;
}

const props = withDefaults(defineProps<Props>(), {
  templateKey: "product-grocery",
});

const template = computed(() => getStorefrontTemplate(props.templateKey));
const design = computed(() => template.value.design);

const heroStyle = computed(() => ({
  background: `linear-gradient(135deg, ${design.value.recommendedColors.primary} 0%, ${design.value.recommendedColors.accent} 100%)`,
}));
</script>

<template>
  <div class="min-h-screen" :style="{ backgroundColor: design.recommendedColors.background }">
    <section class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div class="overflow-hidden rounded-2xl p-6 text-white sm:p-8" :style="heroStyle">
        <div class="h-3 w-24 animate-pulse rounded-full bg-white/20" />
        <div class="mt-6 flex items-center gap-4">
          <div class="h-16 w-16 animate-pulse rounded-2xl bg-white/20" />
          <div class="space-y-2">
            <div class="h-5 w-48 animate-pulse rounded-full bg-white/20" />
            <div class="h-3 w-24 animate-pulse rounded-full bg-white/15" />
          </div>
        </div>
        <div class="mt-5 h-6 w-3/4 animate-pulse rounded-full bg-white/20" />
        <div class="mt-3 h-4 w-full animate-pulse rounded-full bg-white/15" />
        <div class="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-white/15" />
      </div>

      <div class="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="i in 6" :key="i" class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div class="aspect-[4/3] animate-pulse bg-slate-200 dark:bg-slate-800" />
          <div class="space-y-2 p-5">
            <div class="h-5 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div class="h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div class="h-3 w-1/2 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div class="flex items-center justify-between pt-2">
              <div class="h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div class="h-5 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
