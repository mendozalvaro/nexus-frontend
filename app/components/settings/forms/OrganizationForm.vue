<script setup lang="ts">
import type { SettingsOrganization, UpdateOrgPayload } from "@/composables/useSettings";
import { CURRENCIES, COUNTRIES, TIMEZONES } from "@/utils/onboarding";
import { countryDefaults } from "@/utils/constants";

interface Props {
  org: SettingsOrganization | null;
  loading: boolean;
  mutationLoading: boolean;
  error: string | null;
}

interface Emits {
  (e: "submit", payload: UpdateOrgPayload): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const form = reactive({
  name: "",
  slug: "",
  timezone: "",
  currency_code: "",
  country: "",
  business_type: "hybrid" as "products" | "services" | "hybrid",
  address: "",
});

const original = reactive({
  name: "",
  slug: "",
  timezone: "",
  currency_code: "",
  country: "",
  business_type: "hybrid" as "products" | "services" | "hybrid",
  address: "",
});

const formErrors = ref<Record<string, string>>({});
const saved = ref(false);
const slugChecking = ref(false);
const slugAvailable = ref<boolean | null>(null);
const slugMessage = ref("");
let slugDebounce: ReturnType<typeof setTimeout> | null = null;

const businessTypeOptions = [
  { value: "products" as const, label: "Productos", icon: "i-lucide-package", desc: "Venta de productos fisicos o digitales" },
  { value: "services" as const, label: "Servicios", icon: "i-lucide-concierge-bell", desc: "Prestacion de servicios profesionales" },
  { value: "hybrid" as const, label: "Hibrido", icon: "i-lucide-layers", desc: "Productos y servicios combinados" },
];

const currencyOptions = computed(() =>
  CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} - ${c.label}` })),
);

const countryOptions = computed(() =>
  COUNTRIES.map((c) => ({ value: c.code, label: c.label })),
);

const timezoneOptions = computed(() =>
  TIMEZONES.map((t) => ({ value: t.value, label: t.label })),
);

const isDirty = computed(() =>
  form.name !== original.name ||
  form.slug !== original.slug ||
  form.timezone !== original.timezone ||
  form.currency_code !== original.currency_code ||
  form.country !== original.country ||
  form.business_type !== original.business_type ||
  form.address !== original.address,
);

const nameCount = computed(() => form.name.length);
const slugCount = computed(() => form.slug.length);

watch(
  () => props.org,
  (org) => {
    if (!org) return;
    const name = org.name ?? "";
    const slug = org.slug ?? "";
    const timezone = org.timezone ?? "America/La_Paz";
    const currency = org.currency_code ?? "BOB";
    const country = org.country ?? "BO";
    const businessType = (org.business_type as "products" | "services" | "hybrid") ?? "hybrid";
    const address = org.address ?? "";

    form.name = name;
    form.slug = slug;
    form.timezone = timezone;
    form.currency_code = currency;
    form.country = country;
    form.business_type = businessType;
    form.address = address;

    original.name = name;
    original.slug = slug;
    original.timezone = timezone;
    original.currency_code = currency;
    original.country = country;
    original.business_type = businessType;
    original.address = address;

    formErrors.value = {};
    saved.value = false;
    slugAvailable.value = null;
    slugMessage.value = "";
  },
  { immediate: true },
);

watch(
  () => form.slug,
  (val) => {
    slugAvailable.value = null;
    slugMessage.value = "";
    if (slugDebounce) clearTimeout(slugDebounce);
    const trimmed = val.trim().toLowerCase();
    if (!trimmed || trimmed.length < 4) return;
    slugDebounce = setTimeout(async () => {
      slugChecking.value = true;
      try {
        const res = await $fetch<{ available: boolean; message: string }>("/api/organization/slug-check", {
          query: { slug: trimmed },
        });
        slugAvailable.value = res.available;
        slugMessage.value = res.message;
      } catch {
        slugAvailable.value = null;
        slugMessage.value = "No se pudo verificar";
      } finally {
        slugChecking.value = false;
      }
    }, 500);
  },
);

const handleCountryChange = (value: string) => {
  form.country = value;
  const defaults = countryDefaults[value];
  if (defaults) {
    form.timezone = defaults.timezone;
    form.currency_code = defaults.currency;
  }
};

const validate = (): boolean => {
  formErrors.value = {};
  if (!form.name.trim()) formErrors.value.name = "El nombre es requerido.";
  else if (form.name.trim().length < 2) formErrors.value.name = "Minimo 2 caracteres.";
  else if (form.name.trim().length > 120) formErrors.value.name = "Maximo 120 caracteres.";
  if (!form.slug.trim()) formErrors.value.slug = "La direccion virtual es requerida.";
  else if (form.slug.trim().length < 4) formErrors.value.slug = "Minimo 4 caracteres.";
  else if (form.slug.trim().length > 50) formErrors.value.slug = "Maximo 50 caracteres.";
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) formErrors.value.slug = "Solo letras minusculas, numeros y guiones.";
  else if (slugAvailable.value === false) formErrors.value.slug = "Este slug ya esta en uso.";
  if (!form.timezone) formErrors.value.timezone = "Requerida.";
  if (!form.currency_code) formErrors.value.currency_code = "Requerida.";
  if (!form.country) formErrors.value.country = "Requerido.";
  if (form.address.length > 300) formErrors.value.address = "Maximo 300 caracteres.";
  return Object.keys(formErrors.value).length === 0;
};

const handleSubmit = async () => {
  if (!validate()) return;
  emit("submit", {
    name: form.name.trim(),
    slug: form.slug.trim(),
    timezone: form.timezone,
    currency_code: form.currency_code,
    country: form.country,
    business_type: form.business_type,
    address: form.address.trim() || null,
  });
  saved.value = true;
  setTimeout(() => { saved.value = false; }, 3000);
};

const handleReset = () => {
  form.name = original.name;
  form.slug = original.slug;
  form.timezone = original.timezone;
  form.currency_code = original.currency_code;
  form.country = original.country;
  form.business_type = original.business_type;
  form.address = original.address;
  formErrors.value = {};
  slugAvailable.value = null;
  slugMessage.value = "";
};
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-6">
    <div class="grid gap-4 md:grid-cols-2">
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre de la organizacion</label>
        <div class="relative mt-1">
          <UInput
            v-model="form.name"
            placeholder="Mi Empresa S.R.L."
            :disabled="loading || mutationLoading"
            :error="formErrors.name"
            class="w-full"
          />
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{{ nameCount }}/120</span>
        </div>
        <p v-if="formErrors.name" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ formErrors.name }}</p>
      </div>

      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">Direccion virtual</label>
        <div class="relative mt-1">
          <UInput
            v-model="form.slug"
            placeholder="mi-empresa"
            :disabled="loading || mutationLoading"
            :error="formErrors.slug"
            class="w-full"
          />
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{{ slugCount }}/50</span>
        </div>
        <div class="mt-1 flex items-center gap-1">
          <UIcon
            v-if="slugChecking"
            name="i-lucide-loader"
            class="h-3 w-3 animate-spin text-slate-400"
          />
          <UIcon
            v-else-if="slugAvailable === true"
            name="i-lucide-check-circle"
            class="h-3 w-3 text-green-500"
          />
          <UIcon
            v-else-if="slugAvailable === false"
            name="i-lucide-x-circle"
            class="h-3 w-3 text-red-500"
          />
          <span
            class="text-xs"
            :class="slugAvailable === true ? 'text-green-600 dark:text-green-400' : slugAvailable === false ? 'text-red-600 dark:text-red-400' : 'text-slate-400'"
          >
            {{ slugMessage || "Minimo 4 caracteres: letras, numeros y guiones" }}
          </span>
        </div>
        <p v-if="formErrors.slug" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ formErrors.slug }}</p>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de negocio</label>
      <div class="mt-2 grid gap-3 sm:grid-cols-3">
        <button
          v-for="opt in businessTypeOptions"
          :key="opt.value"
          type="button"
          class="flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition"
          :class="form.business_type === opt.value
            ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-400 dark:border-primary-500 dark:bg-primary-950/30 dark:ring-primary-500'
            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'"
          @click="form.business_type = opt.value"
        >
          <UIcon :name="opt.icon" class="h-5 w-5 text-slate-500 dark:text-slate-400" />
          <span class="text-sm font-medium text-slate-900 dark:text-white">{{ opt.label }}</span>
          <span class="text-xs text-slate-500 dark:text-slate-400">{{ opt.desc }}</span>
        </button>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <UFormField label="Pais" :error="formErrors.country">
        <USelect
          v-model="form.country"
          :options="countryOptions"
          :disabled="loading || mutationLoading"
          @update:model-value="handleCountryChange($event as string)"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Moneda" :error="formErrors.currency_code">
        <USelect
          v-model="form.currency_code"
          :options="currencyOptions"
          :disabled="loading || mutationLoading"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Zona horaria" :error="formErrors.timezone">
        <USelect
          v-model="form.timezone"
          :options="timezoneOptions"
          :disabled="loading || mutationLoading"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField label="Direccion" :error="formErrors.address" :hint="`${form.address.length}/300`">
      <UTextarea
        v-model="form.address"
        placeholder="Calle, numero, ciudad"
        :rows="2"
        :disabled="loading || mutationLoading"
        class="w-full"
      />
    </UFormField>

    <div v-if="error" class="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
      <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-if="saved" class="rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
      <p class="text-sm text-green-700 dark:text-green-300">Cambios guardados correctamente.</p>
    </div>

    <div class="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        :disabled="!isDirty || mutationLoading"
        @click="handleReset"
      >
        Descartar cambios
      </UButton>
      <UButton
        type="submit"
        color="primary"
        :loading="mutationLoading"
        :disabled="!isDirty || loading || mutationLoading"
      >
        Guardar cambios
      </UButton>
    </div>
  </form>
</template>
