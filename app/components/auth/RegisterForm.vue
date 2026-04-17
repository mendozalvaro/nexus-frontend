<script setup lang="ts">
import type { RegistrationDraft } from "@/types/registration";
import { REGISTRATION_SCHEMA } from "@/utils/onboarding";

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

const passwordStrengthScore = computed(() => {
  const password = state.password ?? "";
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length >= 12) score += 1;

  return score;
});

const passwordStrengthLabel = computed(() => {
  switch (passwordStrengthScore.value) {
    case 5:
      return "Muy fuerte";
    case 4:
      return "Fuerte";
    case 3:
      return "Mediana";
    case 2:
      return "Débil";
    default:
      return "Muy débil";
  }
});

const passwordStrengthColor = computed(() => {
  switch (passwordStrengthScore.value) {
    case 5:
      return "bg-emerald-500";
    case 4:
      return "bg-lime-500";
    case 3:
      return "bg-amber-500";
    case 2:
      return "bg-orange-500";
    default:
      return "bg-rose-500";
  }
});

const passwordStrengthPercent = computed(() => {
  return (passwordStrengthScore.value / 5) * 100;
});

watch(() => props.modelValue, (value) => {
  Object.assign(state, value);
}, { deep: true });

watch(state, (value) => {
  emit("update:modelValue", { ...value });
}, { deep: true });
</script>

<template>
  <UCard class="admin-shell-panel auth-form-card auth-fade-in rounded-[2rem] p-1">
    <div class="rounded-[1.75rem] px-4 py-5 sm:px-7 sm:py-7">
      <div class="mb-8 text-center">
        <div class="nexus-logo-shell auth-logo-mark mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.75rem] text-lg font-semibold text-white shadow-lg shadow-primary-500/25">
          NP
        </div>
        <p class="text-sm font-semibold uppercase tracking-[0.28em] text-slate-600 dark:text-slate-300">Paso 1 de 3</p>
        <h2 class="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Crea tu cuenta</h2>
        <p class="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">Despues verificaremos tu email.</p>
      </div>

      <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-octagon-alert" :title="error" class="mb-4" />

      <UForm :schema="REGISTRATION_SCHEMA" :state="state" :validate-on="['blur']" class="auth-form-stack"
        @submit="emit('submit')">
        <div class="space-y-4">
          <UFormField label="Nombre completo" name="fullName">
            <UInput v-model="state.fullName" size="xl" autocomplete="name" icon="i-lucide-user-round"
              class="w-full" :ui="{ base: 'min-h-11 text-base' }" />
          </UFormField>

          <UFormField label="Email" name="email">
            <UInput v-model="state.email" type="email" size="xl" autocomplete="email" icon="i-lucide-mail"
              class="w-full" :ui="{ base: 'min-h-11 text-base' }" />
          </UFormField>

          <UFormField label="Contrasena" name="password">
            <UInput v-model="state.password" type="password" size="xl" autocomplete="new-password"
              icon="i-lucide-lock-keyhole" class="w-full" :ui="{ base: 'min-h-11 text-base' }" />
          </UFormField>

          <div class="mt-2">
            <div class="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
              <span>Seguridad de contraseña</span>
              <span class="font-semibold text-slate-700 dark:text-slate-100">{{ passwordStrengthLabel }}</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700">
              <div
                :class="['h-full rounded-full transition-all duration-300', passwordStrengthColor]"
                :style="{ width: `${passwordStrengthPercent}%` }"
              ></div>
            </div>
          </div>
        </div>

        <div class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/70 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-950/50">
          <UCheckbox v-model="state.acceptTerms" class="admin-focus-ring">
            <template #label>
              <span>Acepto los <NuxtLink to="/terms" class="font-semibold text-primary-700 dark:text-primary-300">Terminos de Servicio</NuxtLink> y la <NuxtLink to="/privacy" class="font-semibold text-primary-700 dark:text-primary-300">Politica de Privacidad</NuxtLink>.</span>
            </template>
          </UCheckbox>
        </div>

        <UButton type="submit" :loading="loading" :disabled="loading" block size="xl"
          class="auth-submit-button min-h-11">
          {{ loading ? "Creando cuenta..." : "Crear cuenta" }}
        </UButton>
      </UForm>
    </div>
  </UCard>
</template>
