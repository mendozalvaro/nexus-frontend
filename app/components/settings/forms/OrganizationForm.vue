<script setup lang="ts">
import type { SettingsOrganization, UpdateOrgPayload } from "@/composables/useSettings";
import {
  COUNTRIES,
  getCountryByCode,
  getCurrencyOptionsForCountry,
  getTimezoneOptionsForCountry,
} from "@/utils/onboarding";
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
  timezone: "",
  currency_code: "",
  country: "",
  address: "",
});

const original = reactive({
  name: "",
  timezone: "",
  currency_code: "",
  country: "",
  address: "",
});

const formErrors = ref<Record<string, string>>({});
const saved = ref(false);

const countryOptions = computed(() =>
  COUNTRIES.map((country) => ({ value: country.code, label: country.label })),
);

const currencyOptions = computed(() =>
  getCurrencyOptionsForCountry(form.country).map((currency) => ({
    value: currency.code,
    label: `${currency.code} - ${currency.label}`,
  })),
);

const timezoneOptions = computed(() =>
  getTimezoneOptionsForCountry(form.country).map((timezone) => ({
    value: timezone.value,
    label: timezone.label,
  })),
);

const selectedCountry = computed(() => getCountryByCode(form.country));

const isDirty = computed(() =>
  form.name !== original.name
  || form.timezone !== original.timezone
  || form.currency_code !== original.currency_code
  || form.country !== original.country
  || form.address !== original.address,
);

const nameCount = computed(() => form.name.length);

watch(
  () => props.org,
  (org) => {
    if (!org) return;
    const name = org.name ?? "";
    const timezone = org.timezone ?? "America/La_Paz";
    const currency = org.currency_code ?? "BOB";
    const country = org.country ?? "BO";
    const address = org.address ?? "";

    form.name = name;
    form.timezone = timezone;
    form.currency_code = currency;
    form.country = country;
    form.address = address;

    original.name = name;
    original.timezone = timezone;
    original.currency_code = currency;
    original.country = country;
    original.address = address;

    formErrors.value = {};
    saved.value = false;
  },
  { immediate: true },
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
    timezone: form.timezone,
    currency_code: form.currency_code,
    country: form.country,
    address: form.address.trim() || null,
  });

  saved.value = true;
  setTimeout(() => {
    saved.value = false;
  }, 3000);
};

const handleReset = () => {
  form.name = original.name;
  form.timezone = original.timezone;
  form.currency_code = original.currency_code;
  form.country = original.country;
  form.address = original.address;
  formErrors.value = {};
};
</script>

<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <div class="grid gap-4 md:grid-cols-1">
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
    </div>

    <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div class="mb-3 space-y-1">
        <h3 class="text-base font-semibold text-slate-900 dark:text-white text-uppercase">CONFIGURACIÓN REGIONAL</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">El país sugiere moneda y zona horaria, pero puedes ajustarlas.</p>
      </div>

      <div class="space-y-4">
        <UFormField
          label="Pais"
          :error="formErrors.country"
          hint="Base regional de la organización."
        >
          <USelect
            v-model="form.country"
            :items="countryOptions"
            label-key="label"
            value-key="value"
            :disabled="loading || mutationLoading"
            class="w-full"
            @update:model-value="handleCountryChange($event as string)"
          />
        </UFormField>

        <div
          v-if="selectedCountry"
          class="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300"
        >
          <span class="font-medium text-slate-900 dark:text-white">Sugerencia para: {{ selectedCountry.label }}</span>
          <span class="text-slate-400 dark:text-slate-500">· Moneda </span>
          <span>{{ countryDefaults[form.country]?.currency ?? form.currency_code }}</span>
          <span class="text-slate-400 dark:text-slate-500">· Zona horaria </span>
          <span>{{ countryDefaults[form.country]?.timezone ?? form.timezone }}</span>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <UFormField
            label="Moneda"
            :error="formErrors.currency_code"
            hint="Puedes cambiarla."
          >
            <USelect
              v-model="form.currency_code"
              :items="currencyOptions"
              label-key="label"
              value-key="value"
              :disabled="loading || mutationLoading"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Zona horaria"
            :error="formErrors.timezone"
            hint="Puedes ajustarla."
          >
            <USelect
              v-model="form.timezone"
              :items="timezoneOptions"
              label-key="label"
              value-key="value"
              :disabled="loading || mutationLoading"
              class="w-full"
            />
          </UFormField>
        </div>
      </div>
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
