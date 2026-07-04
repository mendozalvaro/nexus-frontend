<script setup lang="ts">
import { getStorefrontTemplate } from "@/utils/storefront";

import type { StorefrontAccess, StorefrontBusinessType, StorefrontSettings } from "@/types/storefront";

interface Props {
  settings: StorefrontSettings | null;
  access: StorefrontAccess | null;
  loading: boolean;
  mutationLoading: boolean;
  error: string | null;
  availableBusinessTypes: StorefrontBusinessType[];
}

interface Emits {
  (e: "submit", payload: {
    slug: string;
    businessType: StorefrontBusinessType;
    templateKey: StorefrontSettings["templateKey"];
    colorPresetKey: StorefrontSettings["colorPresetKey"];
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    companyDescription: string | null;
    isPublished: boolean;
  }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const liveTemplateKey = ref<StorefrontSettings["templateKey"]>("product-grocery");
const liveColorPresetKey = ref<StorefrontSettings["colorPresetKey"]>("neutral");
const livePrimaryColor = ref("#111827");
const liveSecondaryColor = ref("#F3F4F6");
const liveAccentColor = ref("#2563EB");
const liveCompanyDescription = ref<string | null>(null);

const template = computed(() => props.settings ? getStorefrontTemplate(props.settings.templateKey) : null);
const publicPath = computed(() => props.settings?.slug ? `/${props.settings.slug}` : "");

const syncFromSettings = () => {
  if (!props.settings) {
    return;
  }
  liveTemplateKey.value = props.settings.templateKey;
  liveColorPresetKey.value = props.settings.colorPresetKey;
  livePrimaryColor.value = props.settings.primaryColor;
  liveSecondaryColor.value = props.settings.secondaryColor;
  liveAccentColor.value = props.settings.accentColor;
  liveCompanyDescription.value = props.settings.companyDescription;
};

watch(() => props.settings, syncFromSettings, { immediate: true });

const handleFormChange = (payload: {
  templateKey: StorefrontSettings["templateKey"];
  colorPresetKey: StorefrontSettings["colorPresetKey"];
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  companyDescription: string | null;
}) => {
  liveTemplateKey.value = payload.templateKey;
  liveColorPresetKey.value = payload.colorPresetKey;
  livePrimaryColor.value = payload.primaryColor;
  liveSecondaryColor.value = payload.secondaryColor;
  liveAccentColor.value = payload.accentColor;
  liveCompanyDescription.value = payload.companyDescription;
};

const handleFormUpdate = (payload: {
  slug: string;
  businessType: StorefrontBusinessType;
  templateKey: StorefrontSettings["templateKey"];
  colorPresetKey: StorefrontSettings["colorPresetKey"];
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  companyDescription: string | null;
  isPublished: boolean;
}) => {
  handleFormChange(payload);
  emit("submit", payload);
};
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[1fr_1fr]">
    <UCard class="rounded-3xl">
      <template #header>
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Tienda virtual</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400">Configura slug, colores y plantilla del storefront publico.</p>
        </div>
      </template>

      <SettingsFormsStorefrontForm
        :settings="settings"
        :access="access"
        :loading="loading"
        :mutation-loading="mutationLoading"
        :error="error"
        :available-business-types="availableBusinessTypes"
        @submit="handleFormUpdate"
        @change="handleFormChange"
      />
    </UCard>

    <div class="space-y-6">
      <UCard class="rounded-3xl">
        <template #header>
          <div>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Vista previa en vivo</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Los cambios se reflejan al instante.</p>
          </div>
        </template>

        <SettingsFormsStorefrontPreview
          :template-key="liveTemplateKey"
          :color-preset-key="liveColorPresetKey"
          :primary-color="livePrimaryColor"
          :secondary-color="liveSecondaryColor"
          :accent-color="liveAccentColor"
          :company-description="liveCompanyDescription"
        />
      </UCard>

      <UCard class="rounded-3xl">
        <template #header>
          <div>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Resumen</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Estado actual del storefront.</p>
          </div>
        </template>

        <div class="space-y-4">
          <div
            class="rounded-3xl p-4 text-white"
            :style="{ background: `linear-gradient(135deg, ${settings?.primaryColor ?? '#111827'} 0%, ${settings?.accentColor ?? '#2563EB'} 100%)` }"
          >
            <p class="text-xs uppercase tracking-[0.2em] text-white/70">{{ template?.eyebrow ?? 'Storefront' }}</p>
            <p class="mt-2 text-lg font-semibold">{{ template?.label ?? 'Plantilla' }}</p>
            <p class="mt-1 text-sm text-white/80">{{ settings?.companyDescription || template?.heroSubtitle || 'Sin descripcion.' }}</p>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Enlace</p>
            <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">{{ publicPath || "Sin slug" }}</p>
            <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {{ settings?.isPublished ? "Publicado" : "Borrador" }}
              <span v-if="access?.reason">· {{ access.reason }}</span>
            </p>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div class="flex gap-2">
              <span class="h-9 flex-1 rounded-2xl" :style="{ backgroundColor: settings?.primaryColor ?? '#111827' }" />
              <span class="h-9 flex-1 rounded-2xl" :style="{ backgroundColor: settings?.secondaryColor ?? '#F3F4F6' }" />
              <span class="h-9 flex-1 rounded-2xl" :style="{ backgroundColor: settings?.accentColor ?? '#2563EB' }" />
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Diseno de plantilla</p>
            <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">{{ template?.design.styleName ?? "Clasico" }}</p>
            <p class="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{{ template?.design.styleKeywords.join(", ") }}</p>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
