<script setup lang="ts">
import { STOREFRONT_COLOR_PRESETS, STOREFRONT_TEMPLATES, getStorefrontColorPreset } from "@/utils/storefront";

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
  (e: "change", payload: {
    templateKey: StorefrontSettings["templateKey"];
    colorPresetKey: StorefrontSettings["colorPresetKey"];
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    companyDescription: string | null;
  }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const form = reactive({
  slug: "",
  businessType: "product" as StorefrontBusinessType,
  templateKey: "product-grocery" as StorefrontSettings["templateKey"],
  colorPresetKey: "neutral" as StorefrontSettings["colorPresetKey"],
  primaryColor: "#111827",
  secondaryColor: "#F3F4F6",
  accentColor: "#2563EB",
  companyDescription: "",
  isPublished: false,
});

const original = reactive({ ...form });
const formErrors = ref<Record<string, string>>({});
const saved = ref(false);
const slugChecking = ref(false);
const slugAvailable = ref<boolean | null>(null);
const slugMessage = ref("");
const copyFeedback = ref("");
let slugDebounce: ReturnType<typeof setTimeout> | null = null;

const businessTypeOptions = computed(() => [
  { value: "product" as const, label: "Producto" },
  { value: "service" as const, label: "Servicio" },
  { value: "lodging" as const, label: "Hospedaje" },
].filter((item) => props.availableBusinessTypes.includes(item.value)));

const availableTemplates = computed(() => {
  const allowed = props.access?.allowedTemplateKeys ?? [];
  return STOREFRONT_TEMPLATES.filter((template) => {
    if (template.businessType !== form.businessType) {
      return false;
    }
    return allowed.length === 0 || allowed.includes(template.key);
  });
});

const publicUrl = computed(() => {
  if (!form.slug) {
    return "";
  }

  if (import.meta.client) {
    return `${window.location.origin}/${form.slug}`;
  }

  return `/${form.slug}`;
});

const isDirty = computed(() =>
  form.slug !== original.slug
  || form.businessType !== original.businessType
  || form.templateKey !== original.templateKey
  || form.colorPresetKey !== original.colorPresetKey
  || form.primaryColor !== original.primaryColor
  || form.secondaryColor !== original.secondaryColor
  || form.accentColor !== original.accentColor
  || form.companyDescription !== original.companyDescription
  || form.isPublished !== original.isPublished,
);

watch(
  () => props.settings,
  (value) => {
    if (!value) {
      return;
    }

    form.slug = value.slug;
    form.businessType = value.businessType;
    form.templateKey = value.templateKey;
    form.colorPresetKey = value.colorPresetKey;
    form.primaryColor = value.primaryColor;
    form.secondaryColor = value.secondaryColor;
    form.accentColor = value.accentColor;
    form.companyDescription = value.companyDescription ?? "";
    form.isPublished = value.isPublished;

    Object.assign(original, {
      slug: value.slug,
      businessType: value.businessType,
      templateKey: value.templateKey,
      colorPresetKey: value.colorPresetKey,
      primaryColor: value.primaryColor,
      secondaryColor: value.secondaryColor,
      accentColor: value.accentColor,
      companyDescription: value.companyDescription ?? "",
      isPublished: value.isPublished,
    });

    formErrors.value = {};
    slugAvailable.value = null;
    slugMessage.value = "";
  },
  { immediate: true },
);

watch(
  () => form.businessType,
  (value) => {
    const firstTemplate = availableTemplates.value[0];
    if (!availableTemplates.value.some((template) => template.key === form.templateKey) && firstTemplate) {
      form.templateKey = firstTemplate.key;
    }
    if (!props.availableBusinessTypes.includes(value) && props.availableBusinessTypes[0]) {
      form.businessType = props.availableBusinessTypes[0];
    }
  },
);

watch(
  () => form.colorPresetKey,
  (value) => {
    if (props.access?.canCustomColors) {
      return;
    }

    const preset = getStorefrontColorPreset(value);
    form.primaryColor = preset.primary;
    form.secondaryColor = preset.secondary;
    form.accentColor = preset.accent;
  },
);

const emitChange = () => {
  emit("change", {
    templateKey: form.templateKey,
    colorPresetKey: form.colorPresetKey,
    primaryColor: form.primaryColor,
    secondaryColor: form.secondaryColor,
    accentColor: form.accentColor,
    companyDescription: form.companyDescription.trim() || null,
  });
};

watch(
  () => [form.templateKey, form.colorPresetKey, form.primaryColor, form.secondaryColor, form.accentColor, form.companyDescription],
  () => { emitChange(); },
  { deep: true },
);

watch(
  () => form.slug,
  (value) => {
    slugAvailable.value = null;
    slugMessage.value = "";
    if (slugDebounce) {
      clearTimeout(slugDebounce);
    }

    const trimmed = value.trim().toLowerCase();
    const originalSlug = original.slug.trim().toLowerCase();
    if (!trimmed || trimmed.length < 4) {
      return;
    }

    if (trimmed === originalSlug) {
      slugAvailable.value = true;
      slugMessage.value = "Disponible (actual)";
      return;
    }

    slugDebounce = setTimeout(async () => {
      slugChecking.value = true;
      try {
        const response = await $fetch<{ available: boolean; message: string }>("/api/organization/slug-check", {
          query: { slug: trimmed },
        });
        slugAvailable.value = response.available;
        slugMessage.value = response.message;
      } catch {
        slugAvailable.value = null;
        slugMessage.value = "No se pudo verificar";
      } finally {
        slugChecking.value = false;
      }
    }, 500);
  },
);

const validate = () => {
  formErrors.value = {};

  if (!form.slug.trim()) {
    formErrors.value.slug = "La direccion virtual es requerida.";
  } else if (form.slug.trim().length < 4) {
    formErrors.value.slug = "Minimo 4 caracteres.";
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) {
    formErrors.value.slug = "Solo letras minusculas, numeros y guiones.";
  } else if (slugAvailable.value === false) {
    formErrors.value.slug = "Este slug ya esta en uso.";
  }

  if (!availableTemplates.value.some((template) => template.key === form.templateKey)) {
    formErrors.value.templateKey = "Selecciona una plantilla valida.";
  }

  if (form.companyDescription.trim().length > 600) {
    formErrors.value.companyDescription = "Maximo 600 caracteres.";
  }

  return Object.keys(formErrors.value).length === 0;
};

const resetForm = () => {
  Object.assign(form, original);
  formErrors.value = {};
  slugAvailable.value = null;
  slugMessage.value = "";
  copyFeedback.value = "";
};

const copyLink = async () => {
  if (!publicUrl.value || !import.meta.client) {
    return;
  }

  await navigator.clipboard.writeText(publicUrl.value);
  copyFeedback.value = "Enlace copiado";
  setTimeout(() => {
    copyFeedback.value = "";
  }, 2500);
};

const submit = () => {
  if (!validate()) {
    return;
  }

  emit("submit", {
    slug: form.slug.trim().toLowerCase(),
    businessType: form.businessType,
    templateKey: form.templateKey,
    colorPresetKey: form.colorPresetKey,
    primaryColor: form.primaryColor,
    secondaryColor: form.secondaryColor,
    accentColor: form.accentColor,
    companyDescription: form.companyDescription.trim() || null,
    isPublished: form.isPublished,
  });

  saved.value = true;
  setTimeout(() => {
    saved.value = false;
  }, 3000);
};
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
      <UFormField label="Direccion virtual" :error="formErrors.slug" hint="Se publicara como /slug">
        <div class="space-y-2">
          <UInput v-model="form.slug" :disabled="loading || mutationLoading" placeholder="mi-negocio" />
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <UIcon v-if="slugChecking" name="i-lucide-loader" class="h-3 w-3 animate-spin text-slate-400" />
            <UIcon v-else-if="slugAvailable === true" name="i-lucide-check-circle" class="h-3 w-3 text-emerald-500" />
            <UIcon v-else-if="slugAvailable === false" name="i-lucide-circle-x" class="h-3 w-3 text-red-500" />
            <span class="text-slate-500 dark:text-slate-400">{{ slugMessage || "Minimo 4 caracteres, solo letras, numeros y guiones." }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/60">
            <span class="truncate text-slate-500 dark:text-slate-400">{{ publicUrl || "Completa el slug para ver el enlace" }}</span>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-copy" :disabled="!publicUrl" @click="copyLink">
              Copiar enlace
            </UButton>
            <span v-if="copyFeedback" class="text-emerald-600 dark:text-emerald-400">{{ copyFeedback }}</span>
          </div>
        </div>
      </UFormField>

      <div class="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Publicacion</p>
        <div class="mt-3 flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-slate-900 dark:text-white">Tienda visible</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ access?.canPublish ? "Permite abrir el storefront publico." : "Tu plan no permite publicar aun." }}
            </p>
          </div>
          <USwitch v-model="form.isPublished" :disabled="!access?.canPublish || mutationLoading" />
        </div>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <UFormField label="Tipo de negocio">
        <USelect
          v-model="form.businessType"
          :items="businessTypeOptions"
          label-key="label"
          value-key="value"
          :disabled="mutationLoading || availableBusinessTypes.length <= 1"
        />
      </UFormField>

      <UFormField label="Descripcion de la empresa" :error="formErrors.companyDescription" :hint="`${form.companyDescription.length}/600`">
        <UTextarea v-model="form.companyDescription" :rows="3" placeholder="Cuenta brevemente que vendes, como atiendes o que hace especial tu negocio." />
      </UFormField>
    </div>

    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h4 class="text-sm font-semibold text-slate-900 dark:text-white">Plantilla</h4>
          <p class="text-xs text-slate-500 dark:text-slate-400">Elige una variante segun tu negocio.</p>
        </div>
        <p v-if="formErrors.templateKey" class="text-xs text-red-600 dark:text-red-400">{{ formErrors.templateKey }}</p>
      </div>

      <div class="grid gap-3 md:grid-cols-3">
        <button
          v-for="template in availableTemplates"
          :key="template.key"
          type="button"
          class="rounded-3xl border p-4 text-left transition"
          :class="form.templateKey === template.key
            ? 'border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-950/30'
            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-slate-700'"
          @click="form.templateKey = template.key"
        >
          <p class="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{{ template.eyebrow }}</p>
          <p class="mt-2 text-base font-semibold text-slate-900 dark:text-white">{{ template.label }}</p>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ template.description }}</p>
        </button>
      </div>
    </div>

    <div class="space-y-3">
      <div>
        <h4 class="text-sm font-semibold text-slate-900 dark:text-white">Colores</h4>
        <p class="text-xs text-slate-500 dark:text-slate-400">Tres colores base con seis variaciones listas.</p>
      </div>

      <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <button
          v-for="preset in STOREFRONT_COLOR_PRESETS"
          :key="preset.key"
          type="button"
          class="rounded-3xl border p-3 text-left transition"
          :class="form.colorPresetKey === preset.key
            ? 'border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-950/30'
            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/50'"
          @click="form.colorPresetKey = preset.key"
        >
          <div class="flex gap-1">
            <span class="h-7 flex-1 rounded-xl" :style="{ backgroundColor: preset.primary }" />
            <span class="h-7 flex-1 rounded-xl" :style="{ backgroundColor: preset.secondary }" />
            <span class="h-7 flex-1 rounded-xl" :style="{ backgroundColor: preset.accent }" />
          </div>
          <p class="mt-2 text-sm font-medium text-slate-900 dark:text-white">{{ preset.label }}</p>
        </button>
      </div>

      <div v-if="access?.canCustomColors" class="grid gap-3 md:grid-cols-3">
        <UFormField label="Primario">
          <input v-model="form.primaryColor" type="color" class="h-11 w-full rounded-2xl border border-slate-200 bg-white px-2 dark:border-slate-800 dark:bg-slate-950" />
        </UFormField>
        <UFormField label="Secundario">
          <input v-model="form.secondaryColor" type="color" class="h-11 w-full rounded-2xl border border-slate-200 bg-white px-2 dark:border-slate-800 dark:bg-slate-950" />
        </UFormField>
        <UFormField label="Acento">
          <input v-model="form.accentColor" type="color" class="h-11 w-full rounded-2xl border border-slate-200 bg-white px-2 dark:border-slate-800 dark:bg-slate-950" />
        </UFormField>
      </div>
    </div>

    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
      {{ error }}
    </div>

    <div v-if="saved" class="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
      Cambios guardados correctamente.
    </div>

    <div class="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
      <UButton color="neutral" variant="ghost" :disabled="!isDirty || mutationLoading" @click="resetForm">
        Descartar
      </UButton>
      <UButton color="primary" :loading="mutationLoading" :disabled="!isDirty || mutationLoading" @click="submit">
        Guardar tienda virtual
      </UButton>
    </div>
  </div>
</template>
