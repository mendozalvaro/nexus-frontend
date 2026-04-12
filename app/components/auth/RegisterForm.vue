<script setup lang="ts">
import type { CountryOption } from "@/utils/onboarding";
import type { RegistrationDraft } from "@/types/registration";

const props = defineProps<{
  modelValue: RegistrationDraft;
  loading?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: RegistrationDraft];
  submit: [];
}>();

const state = reactive<RegistrationDraft>({ ...props.modelValue });
const { countries } = useRegistration();

const selectedCountry = computed<CountryOption | null>(() => {
  return countries.find((country) => country.code === state.country) ?? null;
});

const normalizePhoneNumber = (phone: string, countryPrefix?: string) => {
  let digits = phone.replace(/[^\d]/g, "");
  if (countryPrefix) {
    const prefixDigits = countryPrefix.replace(/\+/g, "");
    if (digits.startsWith(prefixDigits)) {
      digits = digits.slice(prefixDigits.length);
    }
  }
  return digits.replace(/^0+/, "");
};

const setPhonePrefix = (country: CountryOption | null) => {
  if (!country) {
    return;
  }

  const raw = state.phone ?? "";
  const normalized = normalizePhoneNumber(raw, country.phonePrefix);
  state.phone = normalized.length > 0
    ? `${country.phonePrefix}${normalized}`
    : country.phonePrefix;
};

const phonePlaceholder = computed(() => {
  return selectedCountry.value
    ? `${selectedCountry.value.phonePrefix}71234567`
    : "+59171234567";
});

watch(() => props.modelValue, (value) => {
  Object.assign(state, value);
}, { deep: true });

watch(state, (value) => {
  emit("update:modelValue", { ...value });
}, { deep: true });

watch(selectedCountry, (country, previousCountry) => {
  if (country && country !== previousCountry) {
    setPhonePrefix(country);
  }
}, { immediate: true });

const passwordStrength = computed(() => calculatePasswordStrength(state.password));
</script>

<template>
  <UCard class="admin-shell-panel auth-form-card auth-fade-in rounded-[2rem] p-1">
    <div class="rounded-[1.75rem] px-4 py-5 sm:px-7 sm:py-7">
      <div class="mb-8 text-center">
        <div
          class="nexus-logo-shell auth-logo-mark mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.75rem] text-lg font-semibold text-white shadow-lg shadow-primary-500/25">
          NP
        </div>
        <p class="text-sm font-semibold uppercase tracking-[0.28em] text-slate-600 dark:text-slate-300">Registro inicial
        </p>
        <h2 class="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Crea tu cuenta</h2>
        <p class="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">Verificaremos tu email antes de activar el
          onboarding.</p>
      </div>

      <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-octagon-alert" :title="error" class="mb-4" />

      <UForm :schema="REGISTRATION_SCHEMA" :state="state" :validate-on="['blur']" class="auth-form-stack"
        @submit="emit('submit')">
        <div class="grid gap-4 md:grid-cols-2">
          <UFormField class="auth-field" label="Nombre completo" name="fullName">
            <UInput v-model="state.fullName" size="xl" autocomplete="name" icon="i-lucide-user-round"
              aria-label="Nombre completo" class="w-full" :ui="{ base: 'min-h-11 text-base' }" />
          </UFormField>

          <UFormField class="auth-field" label="Email" name="email">
            <UInput v-model="state.email" type="email" size="xl" autocomplete="email" icon="i-lucide-mail"
              aria-label="Correo electronico" class="w-full" :ui="{ base: 'min-h-11 text-base' }" />
          </UFormField>

          <UFormField class="auth-field" label="Pais" name="country">
            <select v-model="state.country" @change="setPhonePrefix(selectedCountry)"
              class="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition duration-150 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-primary-400 dark:focus:ring-primary-600"
              aria-label="Pais">
              <option value="" disabled>Selecciona un pais</option>
              <option v-for="country in countries" :key="country.code" :value="country.code">
                {{ country.label }} ({{ country.phonePrefix }})
              </option>
            </select>
          </UFormField>

          <UFormField class="auth-field" label="Telefono" name="phone" description="Opcional, pero recomendado.">
            <UInput v-model="state.phone" type="tel" size="xl" autocomplete="tel" icon="i-lucide-phone"
              aria-label="Telefono" class="w-full" :placeholder="phonePlaceholder" :ui="{ base: 'min-h-11 text-base' }" />
          </UFormField>

          <UFormField class="auth-field md:col-span-2" label="Contrasena" name="password">
            <UInput v-model="state.password" type="password" size="xl" autocomplete="new-password"
              icon="i-lucide-lock-keyhole" aria-label="Contrasena" class="w-full" :ui="{ base: 'min-h-11 text-base' }" />
          </UFormField>
        </div>

        <div class="auth-helper-panel">
          <div class="flex items-center justify-between gap-4">
            <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Fuerza de contrasena</p>
            <p class="text-sm font-semibold text-slate-950 dark:text-white">{{ passwordStrength.label }}</p>
          </div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div class="h-full rounded-full transition-all duration-200"
              :class="[passwordStrength.className, passwordStrength.progressClass]" />
          </div>
        </div>

        <div
          class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/70 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-950/50">
          <UCheckbox v-model="state.acceptTerms" class="admin-focus-ring">
            <template #label>
              <span>Acepto los <NuxtLink to="/terms" class="font-semibold text-primary-700 dark:text-primary-300">
                  Terminos de Servicio</NuxtLink> y la <NuxtLink to="/privacy"
                  class="font-semibold text-primary-700 dark:text-primary-300">Politica de Privacidad</NuxtLink>.</span>
            </template>
          </UCheckbox>
        </div>

        <UButton type="submit" :loading="loading" :disabled="loading" block size="xl" class="auth-submit-button min-h-11">
          {{ loading ? "Creando cuenta..." : "Crear cuenta" }}
        </UButton>
      </UForm>
    </div>
  </UCard>
</template>
