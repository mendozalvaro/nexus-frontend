<script setup lang="ts">
import type { PublicStorefrontResponse } from "@/types/storefront";

const props = defineProps<{
  storefront: PublicStorefrontResponse;
}>();

const design = computed(() => props.storefront.template.design);

const headingStyle = computed(() => ({
  fontFamily: design.value.headingFont,
}));

const hasContactInfo = computed(() => {
  return props.storefront.organization.phone
    || props.storefront.organization.email
    || props.storefront.organization.whatsapp
    || props.storefront.organization.instagram
    || props.storefront.organization.address;
});

const currentYear = computed(() => new Date().getFullYear());
</script>

<template>
  <footer class="mt-12 border-t transition-colors duration-500" :style="{ borderColor: `${storefront.settings.primaryColor}20` }">
    <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div class="flex items-center gap-2.5">
            <img
              v-if="storefront.organization.logoUrl"
              :src="storefront.organization.logoUrl"
              :alt="storefront.organization.name"
              class="h-8 w-8 rounded-lg object-cover ring-1 ring-slate-200"
            />
            <div
              v-else
              class="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
              :style="{ backgroundColor: storefront.settings.primaryColor }"
            >
              {{ storefront.organization.name.charAt(0).toUpperCase() }}
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-900 dark:text-white" :style="headingStyle">
                {{ storefront.organization.name }}
              </p>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">{{ storefront.template.label }}</p>
            </div>
          </div>
          <p v-if="storefront.organization.address" class="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {{ storefront.organization.address }}
          </p>
          <p v-if="storefront.organization.country" class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {{ storefront.organization.country }}
          </p>
        </div>

        <div v-if="hasContactInfo">
          <p class="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Contacto</p>
          <ul class="space-y-2">
            <li v-if="storefront.organization.phone">
              <a
                :href="`tel:${storefront.organization.phone}`"
                class="flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                <UIcon name="i-lucide-phone" class="h-4 w-4 shrink-0" :style="{ color: storefront.settings.primaryColor }" />
                {{ storefront.organization.phone }}
              </a>
            </li>
            <li v-if="storefront.organization.email">
              <a
                :href="`mailto:${storefront.organization.email}`"
                class="flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                <UIcon name="i-lucide-mail" class="h-4 w-4 shrink-0" :style="{ color: storefront.settings.primaryColor }" />
                {{ storefront.organization.email }}
              </a>
            </li>
            <li v-if="storefront.organization.whatsapp">
              <a
                :href="`https://wa.me/${storefront.organization.whatsapp.replace(/\D/g, '')}`"
                target="_blank"
                class="flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                <UIcon name="i-lucide-message-circle" class="h-4 w-4 shrink-0" :style="{ color: storefront.settings.primaryColor }" />
                {{ storefront.organization.whatsapp }}
              </a>
            </li>
            <li v-if="storefront.organization.instagram">
              <a
                :href="`https://instagram.com/${storefront.organization.instagram.replace(/^@+/, '')}`"
                target="_blank"
                class="flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                <UIcon name="i-lucide-instagram" class="h-4 w-4 shrink-0" :style="{ color: storefront.settings.primaryColor }" />
                @{{ storefront.organization.instagram.replace(/^@+/, "") }}
              </a>
            </li>
          </ul>
        </div>

        <div v-if="!hasContactInfo" class="sm:col-span-2 lg:col-span-1" />

        <div>
          <p class="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Acerca de</p>
          <p class="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Tienda virtual impulsada por <strong class="font-semibold text-slate-900 dark:text-white">NexusPOS</strong>
          </p>
          <p class="mt-3 text-xs text-slate-400 dark:text-slate-500">
            &copy; {{ currentYear }} NexusPOS. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  </footer>
</template>
